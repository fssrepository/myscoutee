/*
Copyright (c) 2021 Roger Light <roger@atchoo.org>

All rights reserved. This program and the accompanying materials
are made available under the terms of the Eclipse Public License 2.0
and Eclipse Distribution License v1.0 which accompany this distribution.

The Eclipse Public License is available at
   https://www.eclipse.org/legal/epl-2.0/
and the Eclipse Distribution License is available at
  http://www.eclipse.org/org/documents/edl-v10.php.

SPDX-License-Identifier: EPL-2.0 OR EDL-1.0

Contributors:
   Roger Light - initial implementation and documentation.
*/

/*
 * external auth, sending username (which is a firebase token) to a server
 *
 * Compile with:
 *   gcc -I<path to mosquitto-repo/include> -fPIC -shared mosquitto_external_auth.c -o mosquitto_external_auth.so
 *
 * Use in config with:
 *
 *   plugin /path/to/mosquitto_external_auth.so
 *
 * Note that this only works on Mosquitto 2.0 or later.
 */
#include "config.h"

#include <stdio.h>
#include <string.h>

#include "mosquitto_broker.h"
#include "mosquitto_plugin.h"
#include "mosquitto_internal.h"
#include "mosquitto.h"
#include "mqtt_protocol.h"
#include <curl/curl.h>
#include <cjson/cJSON.h>

#define TOPIC "topic"
#define ACTION "action"

static mosquitto_plugin_id_t *plg_id = NULL;
static char *auth_url = NULL;
static char *acl_url = NULL;
static char *disconnect_url = NULL;
static char *auth_token_header = NULL;
static char *auth_user_header = NULL;

static char *allowed_ip = NULL;
static char *allowed_user = NULL;

char *string_concat(const char *str1, const char *str2, const char *delimiter)
{
    size_t len = strlen(str1) + strlen(delimiter) + strlen(str2) + 1;

    char *result = (char *)malloc(len);

    if (result != NULL)
    {
        snprintf(result, len, "%s%s%s", str1, delimiter, str2);
    }

    return result;
}

char *itoa(int num)
{
    int num_length = snprintf(NULL, 0, "%d", num);
    char *result = (char *)malloc(num_length + 1);

    if (result != NULL)
    {
        snprintf(result, num_length + 1, "%d", num);
    }

    return result;
}

static int external_msg_callback(int event, void *event_data, void *userdata)
{
    struct mosquitto_evt_message *ed = event_data;
    const char *username = ed->client->id;

    if (username == NULL)
    {
        mosquitto_log_printf(MOSQ_LOG_ERR, "username parameter is missing");
        return MOSQ_ERR_AUTH;
    }

    UNUSED(event);
    UNUSED(userdata);

    const char *json_str = (const char *)ed->payload;

    // Parse the JSON payload
    cJSON *json_root = cJSON_Parse(json_str);
    if (json_root != NULL)
    {
        cJSON *name = cJSON_CreateString(username);

        cJSON *message = cJSON_GetObjectItem(json_root, "message");
        cJSON_AddItemToObject(message, "from", name);

        char *payload = cJSON_Print(json_root);

        ed->payload = payload;
        ed->payloadlen = (uint32_t)(strlen(payload) + 1);

        // Free the cJSON structure
        cJSON_Delete(json_root);
    }
    else
    {
        printf("JSON is not valid!\n");

        // Optionally, print the error before exiting
        const char *error_ptr = cJSON_GetErrorPtr();
        if (error_ptr != NULL)
        {
            printf("Error before: %s\n", error_ptr);
        }

        return MOSQ_ERR_INVAL;
    }

    return MOSQ_ERR_SUCCESS;
}

struct MemoryStruct
{
    char *memory;
    size_t size;
};

static size_t write_callback(void *contents, size_t size, size_t nmemb, void *userp)
{
    size_t realsize = size * nmemb;
    struct MemoryStruct *mem = (struct MemoryStruct *)userp;

    char *ptr = realloc(mem->memory, mem->size + realsize + 1);
    if (!ptr)
    {
        /* out of memory! */
        printf("not enough memory (realloc returned NULL)\n");
        return 0;
    }

    mem->memory = ptr;
    memcpy(&(mem->memory[mem->size]), contents, realsize);
    mem->size += realsize;
    mem->memory[mem->size] = 0;

    return realsize;
}

static int external_auth_callback(int event, void *event_data, void *userdata)
{
    struct mosquitto_evt_basic_auth *ed = event_data;
    const char *username = ed->username;
    const char *password = ed->password;

    mosquitto_log_printf(MOSQ_LOG_INFO, "client: %s\n;%s\n", username, password);

    if (username == NULL || password == NULL)
    {
        mosquitto_log_printf(MOSQ_LOG_ERR, "username and/or password is missing");
        return MOSQ_ERR_AUTH;
    }

    UNUSED(event);
    UNUSED(userdata);

    // allow athentication on localhost for 'spring' server
    const char *ip_address = mosquitto_client_address(ed->client);
    mosquitto_log_printf(MOSQ_LOG_INFO, "ip_address: %s\n;", ip_address);

    if (!strcmp(ip_address, allowed_ip) && !strcmp(username, allowed_user))
    {
        return MOSQ_ERR_SUCCESS;
    }

    CURL *curl = curl_easy_init();
    if (curl)
    {
        // header
        struct curl_slist *chunk = NULL;
        const char *firebase = string_concat(auth_token_header, password, ": ");
        chunk = curl_slist_append(chunk, firebase);
        curl_easy_setopt(curl, CURLOPT_HTTPHEADER, chunk);

        struct MemoryStruct response_buffer;

        response_buffer.memory = malloc(1); /* will be grown as needed by the realloc above */
        response_buffer.size = 0;

        curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, write_callback);
        curl_easy_setopt(curl, CURLOPT_WRITEDATA, (void *)&response_buffer);

        // url
        curl_easy_setopt(curl, CURLOPT_URL, auth_url);

        CURLcode res = curl_easy_perform(curl);

        mosquitto_log_printf(MOSQ_LOG_INFO, "!!!response!!!: %s\n;", response_buffer.memory);

        int isUsernameValid = strcmp(response_buffer.memory, username) == 0;

        long response_code;
        if (res != CURLE_OK && !isUsernameValid)
        {
            fprintf(stderr, "curl_easy_perform() failed: %s\n",
                    curl_easy_strerror(res));
        }
        else
        {
            curl_easy_getinfo(curl, CURLINFO_RESPONSE_CODE, &response_code);
            if (response_code != 200)
            {
                printf("HTTP Status Code: %ld\n", response_code);
            }
        }

        // cleanup
        free(response_buffer.memory);
        curl_slist_free_all(chunk);
        curl_easy_cleanup(curl);

        if (res != CURLE_OK || response_code != 200 || !isUsernameValid)
        {
            return MOSQ_ERR_AUTH;
        }
    }
    return MOSQ_ERR_SUCCESS;
}

static int external_disconnect_callback(int event, void *event_data, void *userdata)
{
    struct mosquitto_evt_disconnect *ed = event_data;
    const char *username = ed->client->id;

    if (username == NULL)
    {
        mosquitto_log_printf(MOSQ_LOG_ERR, "username parameter is missing");
        return MOSQ_ERR_AUTH;
    }

    UNUSED(event);
    UNUSED(userdata);

    mosquitto_log_printf(MOSQ_LOG_DEBUG, "client: %s\n;", username);

    // allow disconnect on localhost for 'spring' server
    const char *ip_address = mosquitto_client_address(ed->client);
    if (!strcmp(ip_address, allowed_ip) && !strcmp(username, allowed_user))
    {
        return MOSQ_ERR_SUCCESS;
    }

    CURL *curl = curl_easy_init();
    if (curl)
    {
        // header
        struct curl_slist *chunk = NULL;
        const char *firebase = string_concat(auth_user_header, username, ": ");
        chunk = curl_slist_append(chunk, firebase);
        curl_easy_setopt(curl, CURLOPT_HTTPHEADER, chunk);

        // url
        curl_easy_setopt(curl, CURLOPT_URL, disconnect_url);

        CURLcode res = curl_easy_perform(curl);

        long response_code;
        if (res != CURLE_OK)
        {
            fprintf(stderr, "curl_easy_perform() failed: %s\n",
                    curl_easy_strerror(res));
        }
        else
        {
            curl_easy_getinfo(curl, CURLINFO_RESPONSE_CODE, &response_code);
            if (response_code != 200)
            {
                printf("HTTP Status Code: %ld\n", response_code);
            }
        }

        // cleanup
        curl_easy_cleanup(curl);
        curl_slist_free_all(chunk);

        if (res != CURLE_OK || response_code != 200)
        {
            return MOSQ_ERR_NO_CONN;
        }
    }
    return MOSQ_ERR_SUCCESS;
}

static int external_acl_callback(int event, void *event_data, void *userdata)
{
    struct mosquitto_evt_acl_check *ed = event_data;
    const char *username = ed->client->id;
    const char *topic = ed->topic;
    const char *action = itoa(ed->access);

    if (username == NULL)
    {
        mosquitto_log_printf(MOSQ_LOG_ERR, "username parameter is missing");
        return MOSQ_ERR_AUTH;
    }

    UNUSED(event);
    UNUSED(userdata);

    mosquitto_log_printf(MOSQ_LOG_DEBUG, "client: %s\n; topic: %s\n;", username, topic);

    // allow subscribe/unsubscribe on localhost for 'spring' server
    const char *ip_address = mosquitto_client_address(ed->client);
    if (!strcmp(ip_address, allowed_ip) && !strcmp(username, allowed_user))
    {
        return MOSQ_ERR_SUCCESS;
    }

    CURL *curl = curl_easy_init();
    if (curl)
    {
        // header
        struct curl_slist *chunk = NULL;
        const char *firebase = string_concat(auth_user_header, username, ": ");
        chunk = curl_slist_append(chunk, firebase);
        curl_easy_setopt(curl, CURLOPT_HTTPHEADER, chunk);

        // url
        curl_easy_setopt(curl, CURLOPT_URL, acl_url);

        const char *topic_param = string_concat(TOPIC, topic, "=");
        const char *action_param = string_concat(ACTION, action, "=");
        const char *params = string_concat(topic_param, action_param, "&");
        curl_easy_setopt(curl, CURLOPT_POSTFIELDS, params);

        curl_easy_setopt(curl, CURLOPT_VERBOSE, 1L);

        CURLcode res = curl_easy_perform(curl);

        long response_code;
        if (res != CURLE_OK)
        {
            fprintf(stderr, "curl_easy_perform() failed: %s\n",
                    curl_easy_strerror(res));
        }
        else
        {
            curl_easy_getinfo(curl, CURLINFO_RESPONSE_CODE, &response_code);
            if (response_code != 200)
            {
                printf("HTTP Status Code: %ld\n", response_code);
            }
        }

        // cleanup
        curl_easy_cleanup(curl);
        curl_slist_free_all(chunk);

        if (res != CURLE_OK || response_code != 200)
        {
            return MOSQ_ERR_ACL_DENIED;
        }
    }

    return MOSQ_ERR_SUCCESS;
}

int mosquitto_plugin_version(int supported_version_count, const int *supported_versions)
{
    int i;

    for (i = 0; i < supported_version_count; i++)
    {
        if (supported_versions[i] == 5)
        {
            return 5;
        }
    }
    return -1;
}

int register_callback(mosquitto_plugin_id_t *plg_id, int event_type, MOSQ_FUNC_generic_callback callback)
{
    int rc = mosquitto_callback_register(plg_id, event_type, callback, NULL, NULL);
    if (rc == MOSQ_ERR_ALREADY_EXISTS)
    {
        mosquitto_log_printf(MOSQ_LOG_ERR, "Error: Dynamic security plugin can only be loaded once.");
        goto error;
    }
    else if (rc == MOSQ_ERR_NOMEM)
    {
        mosquitto_log_printf(MOSQ_LOG_ERR, "Error: Out of memory.");
        goto error;
    }
    else if (rc != MOSQ_ERR_SUCCESS)
    {
        goto error;
    }

    return MOSQ_ERR_SUCCESS;

error:
    // Handle the error and cleanup, if necessary
    return rc;
}

int mosquitto_plugin_init(mosquitto_plugin_id_t *identifier, void **user_data, struct mosquitto_opt *opts, int opt_count)
{
    int i;
    int rc;

    UNUSED(user_data);

    for (i = 0; i < opt_count; i++)
    {
        if (!strcasecmp(opts[i].key, "url_auth"))
        {
            auth_url = opts[i].value;
        }

        if (!strcasecmp(opts[i].key, "url_acl"))
        {
            acl_url = opts[i].value;
        }

        if (!strcasecmp(opts[i].key, "url_disconnect"))
        {
            disconnect_url = opts[i].value;
        }

        if (!strcasecmp(opts[i].key, "header_auth_token"))
        {
            auth_token_header = opts[i].value;
        }

        if (!strcasecmp(opts[i].key, "header_auth_user"))
        {
            auth_user_header = opts[i].value;
        }

        if (!strcasecmp(opts[i].key, "allowed_ip"))
        {
            allowed_ip = opts[i].value;
        }

        if (!strcasecmp(opts[i].key, "allowed_user"))
        {
            allowed_user = opts[i].value;
        }
    }

    plg_id = identifier;

    if (auth_url != NULL)
    {
        mosquitto_log_printf(MOSQ_LOG_INFO, "auth_url is configured in mosquitto.conf -> register auth!");
        rc = register_callback(plg_id, MOSQ_EVT_BASIC_AUTH, external_auth_callback);
        if (rc != MOSQ_ERR_SUCCESS)
        {
            return rc;
        }

        mosquitto_log_printf(MOSQ_LOG_INFO, "msg callback registered!");
        rc = register_callback(plg_id, MOSQ_EVT_MESSAGE, external_msg_callback);
        if (rc != MOSQ_ERR_SUCCESS)
        {
            return rc;
        }

        if (acl_url != NULL)
        {
            mosquitto_log_printf(MOSQ_LOG_INFO, "acl_url is configured in mosquitto.conf -> register acl!");
            rc = register_callback(plg_id, MOSQ_EVT_ACL_CHECK, external_acl_callback);
            if (rc != MOSQ_ERR_SUCCESS)
            {
                return rc;
            }
        }
        else
        {
            mosquitto_log_printf(MOSQ_LOG_INFO, "acl_url is not configured in mosquitto.conf!");
        }

        if (disconnect_url != NULL)
        {
            mosquitto_log_printf(MOSQ_LOG_INFO, "disconnect_url is configured in mosquitto.conf -> register disconnect!");
            rc = register_callback(plg_id, MOSQ_EVT_DISCONNECT, external_disconnect_callback);
            if (rc != MOSQ_ERR_SUCCESS)
            {
                return rc;
            }
        }
        else
        {
            mosquitto_log_printf(MOSQ_LOG_INFO, "disconnect_url is not configured in mosquitto.conf!");
        }

        curl_global_init(CURL_GLOBAL_ALL);
    }
    else
    {
        mosquitto_log_printf(MOSQ_LOG_ERR, "auth_url is not configured in mosquitto.conf -> plugin will be inactive!");
        return MOSQ_ERR_AUTH_CONTINUE;
    }

    return MOSQ_ERR_SUCCESS;
}

int mosquitto_plugin_cleanup(void *user_data, struct mosquitto_opt *opts, int opt_count)
{
    UNUSED(user_data);
    UNUSED(opts);
    UNUSED(opt_count);

    curl_global_cleanup();

    if (plg_id)
    {
        mosquitto_callback_unregister(plg_id, MOSQ_EVT_BASIC_AUTH, external_auth_callback, NULL);
        mosquitto_callback_unregister(plg_id, MOSQ_EVT_ACL_CHECK, external_acl_callback, NULL);
        mosquitto_callback_unregister(plg_id, MOSQ_EVT_DISCONNECT, external_disconnect_callback, NULL);
    }

    return MOSQ_ERR_SUCCESS;
}
