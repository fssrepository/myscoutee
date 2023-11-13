package com.raxim.myscoutee.common.config.firebase;

import java.io.IOException;
import java.util.Objects;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.filter.OncePerRequestFilter;

import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseToken;
import com.raxim.myscoutee.common.config.firebase.dto.FirebaseCredential;
import com.raxim.myscoutee.common.config.firebase.exception.FirebaseTokenInvalidException;
import com.raxim.myscoutee.common.config.properties.MqttProperties;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

public class FirebaseFilter extends OncePerRequestFilter {
    private static final String AUTH_FIREBASE = "X-Authorization-Firebase";
    private static final String AUTH_USER = "X-Authorization-User";
    private static final String AUTH_LINK = "X-Authorization-Link";

    private final FirebaseService firebaseService;
    private final MqttProperties mqttProperties;

    public FirebaseFilter(FirebaseService firebaseService, MqttProperties mqttProperties) {
        this.firebaseService = firebaseService;
        this.mqttProperties = mqttProperties;
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain) throws ServletException, IOException {
        String xAuth = request.getHeader(AUTH_FIREBASE);
        if (xAuth == null || xAuth.isBlank()) {

            if (request.getRequestURI().startsWith("/mqtt")
                    && request.getRemoteAddr().equals(mqttProperties.getServerIp())) {

                xAuth = request.getHeader(AUTH_USER);
                if (xAuth != null && !xAuth.isBlank()) {
                    UserDetails userDetails = firebaseService.loadUserById(xAuth);

                    Authentication auth = new FirebaseAuthenticationToken(userDetails, null,
                            userDetails.getAuthorities());
                    SecurityContextHolder.getContext().setAuthentication(auth);
                }
            }
            filterChain.doFilter(request, response);
        } else {
            try {
                FirebaseCredential credential = parseToken(xAuth);
                String xLink = request.getHeader(AUTH_LINK);

                UserDetails userDetails = firebaseService.loadUserByUsername(credential.getEmail(), xLink, request.getRequestURI());
                Authentication auth = new FirebaseAuthenticationToken(userDetails, credential,
                        userDetails.getAuthorities());
                SecurityContextHolder.getContext().setAuthentication(auth);

                filterChain.doFilter(request, response);
            } catch (FirebaseTokenInvalidException e) {
                throw new SecurityException(e);
            }
        }
    }

    public FirebaseCredential parseToken(String firebaseToken) {
        Objects.requireNonNull(firebaseToken, "FirebaseToken must not be null or blank");
        try {
            FirebaseToken decodedToken = FirebaseAuth.getInstance().verifyIdToken(firebaseToken);
            return new FirebaseCredential(decodedToken);
        } catch (Exception e) {
            throw new FirebaseTokenInvalidException(e.getMessage());
        }
    }
}
