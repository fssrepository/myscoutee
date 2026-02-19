import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { DocumentItem } from '../models/document-item.interface';

@Injectable({
  providedIn: 'root'
})
export class DocumentService {
  private names = [
    'Kovács János', 'Nagy Péter', 'Szabó Anna', 'Tóth Éva', 'Varga László',
    'Kiss Katalin', 'Molnár Gábor', 'Horváth Zsuzsanna', 'Balogh István', 'Papp Mária',
    'Farkas Tamás', 'Simon Andrea', 'Lakatos Attila', 'Németh Ildikó', 'Antal Krisztián',
    'Rácz Noémi', 'Oláh Balázs', 'Fekete Eszter', 'Vincze Márton', 'Bíró Judit'
  ];

  private statuses = ['Beküldve', 'Iktatva', 'Tájékoztató', 'Hiba', 'Lezárva', 'Elfogadásra vár'];

  private formNames = [
    "2601", "2608", "2608INT", "2611", "26110", "2620", "26251", "2629EUD", "2643TAO", "2649",
    "2650", "2651", "2658", "2665", "2671", "2678", "2691", "2693", "2697", "26A215",
    "26A60", "26CO2", "26J03", "26KATA", "26KIVA", "26KTA", "26KTBEV", "26NETA", "26P90", "26P91",
    "26RENDNY", "26TFEJLH", "2501", "2508", "2508INT", "2511", "25110", "2520", "25251", "2529",
    "2529EUD", "2541", "2543TAO", "2549", "2550", "2551", "2553", "2558", "2565", "2571",
    "2578", "2591", "2592", "2593", "2597", "25A215", "25A60", "25AEOI", "25CO2", "25EGYSZA",
    "25FATCA", "25GYOGYK", "25J03", "25KATA", "25KIVA", "25KOOLAJ", "25KTA", "25KTBEV", "25NETA", "25P90",
    "25P91", "25RENDNY", "25T1044D", "25T1045NY", "25T1046K", "25TFEJLH", "25TMUNK", "2401", "2408", "2408INT",
    "2411", "24110", "2420", "24251", "2429", "2429EUD", "2441", "2443TAO", "2448", "2449",
    "2450", "2451", "2453", "2458", "2465", "2471", "2478", "2491", "2492", "2493",
    "2497", "24A215", "24A60", "24AEOI", "24CBC", "24CO2", "24EGYSZA", "24ENJOV", "24FATCA", "24GLBADO",
    "24GYOGYK", "24J03", "24KATA", "24KIVA", "24KOOLAJ", "24KTA", "24KTBEV", "24NETA", "24P90", "24P91",
    "24TAVKOZ", "24TFEJLH", "2301", "2308", "2308INT", "2311", "23110", "2320", "23251", "2329", "2329EUD", "2341",
    "2343TAO", "2348", "2349", "2350", "2351", "2353", "2358", "2365", "2371", "2378",
    "2391", "2392", "2393", "2394", "2397", "23A215", "23A60", "23CBC", "23CO2", "23EGYSZA",
    "23ENJOV", "23FATCA", "23GYOGYK", "23J03", "23KATA", "23KIVA", "23KOOLAJ", "23KTA", "23KTBEV", "23NETA",
    "23P90", "23P91", "23TAVKOZ", "23TFEJLH", "2201", "2208", "2211", "22110", "2220", "22251",
    "2229", "2229EUD", "2241", "2243TAO", "2248", "2249", "2250", "2251", "2253", "2258",
    "2265", "2271", "2278", "2291", "2292", "2293", "2297", "22A215", "22A60", "22EGYSZA",
    "22ENJOV", "22GYOGYK", "22J03", "22K102", "22KATA", "22KIVA", "22KTA", "22KTBEV", "22NETA", "22P90",
    "22P91", "22TAVKOZ", "22TFEJLH", "2101", "2108", "2108INT", "2111", "21110", "2120", "21251", "2129", "2129EUD", "2141",
    "2143TAO", "2148", "2149", "2150", "2151", "2153", "2158", "2165", "2171", "2178",
    "2191", "2192", "2193", "2197", "21A215", "21A60", "21EGYSZA", "21J03", "21K102", "21K103",
    "21K109", "21K51", "21K59", "21K71", "21K72", "21K73", "21K75", "21K83", "21K84", "21K86",
    "21K90", "21K91", "21K92", "21K95", "21K97", "21KATA", "21KISKER", "21KIVA", "21KTA", "21KTBEV",
    "21NETA", "21P90", "21TFEJLH", "2001", "2008", "2008INT", "2011", "20110", "2020", "20251", "2029", "2029EUD", "2041",
    "2043TAO", "2048", "2049", "2050", "2051", "2053", "2058", "2065", "2071", "2078",
    "2091", "2092", "2093", "2097", "20A215", "20A60", "20J03", "20K102", "20K103", "20K104",
    "20K105", "20K108", "20K109", "20K36", "20K51", "20K59", "20K64", "20K71", "20K72", "20K73",
    "20K75", "20K79", "20K83", "20K84", "20K86", "20K90", "20K91", "20K92", "20K95", "20K97",
    "20KATA", "20KISKER", "20KIVA", "20KTA", "20KTBEV", "20NETA", "20P90", "20P91", "20TFEJLH", "1901",
    "1908", "1908INT", "1910B", "1910M", "1911", "19110", "1920", "19251", "1929", "1929EUD",
    "1941", "1943", "1943TAO", "1948", "1949", "1950", "1951", "1953", "1958", "1965",
    "1971", "1978", "1991", "1992", "1993", "1994", "1997", "19A215", "19A60", "19J03",
    "19K102", "19K103", "19K104", "19K105", "19K108", "19K109", "19K36", "19K50", "19K51", "19K59",
    "19K64", "19K71", "19K72", "19K73", "19K75", "19K79", "19K83", "19K84", "19K86", "19K90",
    "19K91", "19K92", "19K95", "19K97", "19KATA", "19KIVA", "19KTA", "19KTBEV", "19NAHI", "19NETA",
    "19P90", "19TFEJLH", "1801", "1808", "1808INT", "1810B", "1810M", "1811", "18110", "1820", "18251", "1829",
    "1829EUD", "1841", "1843", "1843TAO", "1848", "1849", "1850", "1851", "1853", "1858",
    "1865", "1871", "1878", "1886", "1891", "1892", "1893", "1894", "1897", "18A215",
    "18A60", "18J03", "18K102", "18K103", "18K104", "18K105", "18K108", "18K109", "18K110", "18K36",
    "18K37", "18K50", "18K51", "18K59", "18K64", "18K71", "18K72", "18K73", "18K75", "18K79",
    "18K83", "18K84", "18K86", "18K90", "18K91", "18K92", "18K95", "18K97", "18KATA", "18KIVA",
    "18KTA", "18KTBEV", "18NAHI", "18NETA", "18P90", "18TFEJLH", "1701", "1708", "1708INT", "1710B",
    "1710M", "1711", "17110", "1720", "17251", "1729", "1729EUD", "1741", "1743", "1743TAO", "1748", "1749",
    "1750", "1751", "1753", "1758", "1765", "1771", "1778", "1786", "1791", "1792",
    "1793", "1794", "17A215", "17A60", "17J03", "17K102", "17K103", "17K104", "17K105", "17K108",
    "17K109", "17K110", "17K36", "17K37", "17K50", "17K51", "17K59", "17K64", "17K71", "17K72",
    "17K73", "17K75", "17K79", "17K83", "17K84", "17K86", "17K90", "17K91", "17K92", "17K95",
    "17K97", "17KATA", "17KIVA", "17KTA", "17KTBEV", "17NAHI", "17NETA", "17P90", "1601", "1608",
    "1608E", "1608INT", "1610B", "1610M", "1611", "16110", "1620", "16251", "1629", "1629EUD",
    "1641", "1643", "1643TAO", "1648", "1649", "1650", "1651", "1653", "1658", "1665",
    "1671", "1678", "1686", "1691", "1692", "1693", "1694", "1695", "16A215", "16A60",
    "16HIPA", "16J03", "16K102", "16K103", "16K104", "16K105", "16K108", "16K36", "16K37", "16K50",
    "16K51", "16K59", "16K64", "16K71", "16K72", "16K73", "16K75", "16K79", "16K83", "16K84",
    "16K86", "16K90", "16K91", "16K92", "16K95", "16KATA", "16KIVA", "16KTA", "16KTBEV", "16M29",
    "16NAHI", "16NETA", "16P90", "1501", "1508", "1508E", "1508INT", "1510B", "1510M", "1511", "15110", "1520", "15251",
    "1529", "1529EUD", "1541", "1543", "1543TAO", "1548", "1549", "1550", "1551", "1553",
    "1553ADO", "1553NY", "1558", "1565", "1571", "1578", "1586", "1591", "1592", "1593",
    "1594", "1595", "15A215", "15A60", "15J03", "15K102", "15K103", "15K104", "15K105", "15K108",
    "15K36", "15K37", "15K50", "15K51", "15K59", "15K64", "15K71", "15K72", "15K73", "15K75",
    "15K76", "15K77", "15K79", "15K83", "15K84", "15K85", "15K86", "15K89", "15K90", "15K91",
    "15K92", "15K95", "15K97", "15KATA", "15KIVA", "15M29", "15NAHI", "15NETA", "15P90", "1401",
    "1408", "1408E", "1408INT", "1410B", "1410M", "1411", "14110", "1420", "14251", "1429",
    "1429EUD", "1441", "1443", "1443TAO", "1448", "1449", "1450", "1451", "1453", "1453ADO",
    "1453NY", "1458", "1465", "1471", "1478", "1486", "1491", "1492", "1493", "1494",
    "14A215", "14A60", "14J03", "14K102", "14K103", "14K104", "14K105", "14K106", "14K36", "14K37",
    "14K50", "14K51", "14K59", "14K64", "14K71", "14K72", "14K73", "14K75", "14K76", "14K77",
    "14K79", "14K83", "14K84", "14K85", "14K86", "14K89", "14K90", "14K91", "14K92", "14K95",
    "14KATA", "14KIVA", "14M29", "14NETA", "14P90", "1301", "1308", "1308E", "1308INT", "1310B",
    "1310M", "1311", "13110", "1320", "13251", "1329", "1341", "1343", "1343TAO", "1348", "1349",
    "1350", "1351", "1353", "1353ADO", "1353E", "1353NY", "1358", "1365", "1371", "1378", "1386", "1391", "1392", "1393",
    "13A215", "13A60", "13J03", "13K102", "13K36", "13K37", "13K48", "13K50", "13K51", "13K59",
    "13K64", "13K71", "13K72", "13K73", "13K75", "13K76", "13K77", "13K79", "13K83", "13K84",
    "13K85", "13K86", "13K89", "13K90", "13K91", "13K92", "13K95", "13K97", "13KATA", "13KIVA",
    "13M29", "13NETA", "13P90", "53INT", "ADATKIAD", "BEV_J01", "BEV_J02", "BEV_J04", "DPI",
    "ELMDIJ", "ELOLEGMOD", "GLOBE", "K100", "K102", "K1020", "K103", "K1030", "K104", "K105",
    "K107", "K108", "K109", "K111", "K36", "K51", "K55", "K56", "K59", "K64",
    "K70", "K71", "K72", "K73", "K75", "K79", "K83", "K84", "K86", "K90",
    "K91", "K92", "K950", "K97", "KBIZ", "KCSP", "KEMEL", "KKVHIPA", "KLAKTAM", "KRISZTI_TESZT_2150",
    "KSZERZ", "KVILL", "KVKPELL", "NAV_J08", "NAV_J09", "NAV_J16", "NAV_J22", "NAV_J28", "NAV_J32",
    "NAV_J36", "NAV_J41", "NAV_J43", "NAV_J48", "NY", "SAAFA", "T1044D", "T1045NY", "T1046K", "TAONY",
    "TBSZ", "TENIKO_2597", "TMUNK"
  ];

  private documents: DocumentItem[] = [
    {
      icon: 'description',
      status: 'Elfogadásra vár',
      ugyfel: 'Kovács János',
      formName: '2608INT',
      datetime: '2026-02-02 10:00',
      unread: true,
      searchKey: 'kovács jános ikt-2026-000123 kr-450021 2601 ikt-2026-000124 kr-450022 2608 ikt-2026-000125 kr-450023 2608int',
      items: [
        {
          type: '2601',
          formName: '2601',
          status: 'Beküldve',
          datetime: '2026-01-31 10:00',
          iktatoszam: 'IKT-2026-000123',
          krSzam: 'KR-450021',
          attachments: [
            { name: '2601.pdf' },
            { name: 'Kiegészítés 1.pdf' }
          ]
        },
        {
          type: '2608',
          formName: '2608',
          status: 'Iktatva',
          datetime: '2026-02-01 10:00',
          iktatoszam: 'IKT-2026-000124',
          krSzam: 'KR-450022',
          attachments: [
            { name: '2608.pdf' },
            { name: 'Kiegészítés 2.pdf' },
            { name: 'Kiegészítés 3.pdf' }
          ]
        },
        {
          type: '2608INT',
          formName: '2608INT',
          status: 'Elfogadásra vár',
          datetime: '2026-02-02 10:00',
          iktatoszam: 'IKT-2026-000125',
          krSzam: 'KR-450023',
          attachments: [
            { name: '2608INT.pdf' }
          ]
        }
      ]
    },
    {
      icon: 'insert_drive_file',
      status: 'Lezárva',
      ugyfel: 'Nagy Péter',
      formName: '2620',
      datetime: '2026-01-24 14:30',
      unread: false,
      searchKey: 'nagy péter ikt-2026-000200 kr-450101 2611 ikt-2026-000201 kr-450102 26110 ikt-2026-000202 kr-450103 2620',
      items: [
        {
          type: '2611',
          formName: '2611',
          status: 'Beküldve',
          datetime: '2026-01-22 14:30',
          iktatoszam: 'IKT-2026-000200',
          krSzam: 'KR-450101',
          attachments: [
            { name: '2611.pdf' },
            { name: 'Kiegészítés 1.pdf' }
          ]
        },
        {
          type: '26110',
          formName: '26110',
          status: 'Iktatva',
          datetime: '2026-01-23 14:30',
          iktatoszam: 'IKT-2026-000201',
          krSzam: 'KR-450102',
          attachments: [
            { name: '26110.pdf' }
          ]
        },
        {
          type: '2620',
          formName: '2620',
          status: 'Lezárva',
          datetime: '2026-01-24 14:30',
          iktatoszam: 'IKT-2026-000202',
          krSzam: 'KR-450103',
          attachments: [
            { name: '2620.pdf' }
          ]
        }
      ]
    },
    {
      icon: 'description',
      status: 'Hiba',
      ugyfel: 'Szabó Anna',
      formName: '2643TAO',
      datetime: '2025-12-12 09:15',
      unread: false,
      searchKey: 'szabó anna ikt-2025-000987 kr-440310 26251 ikt-2025-000988 kr-440311 ikt-2025-000989 kr-440312',
      items: [
        {
          type: '26251',
          formName: '26251',
          status: 'Beküldve',
          datetime: '2025-12-10 09:15',
          iktatoszam: 'IKT-2025-000987',
          krSzam: 'KR-440310',
          attachments: [
            { name: '26251.pdf' },
            { name: 'Kiegészítés 4.pdf' }
          ]
        },
        {
          type: '2629EUD',
          formName: '2629EUD',
          status: 'Iktatva',
          datetime: '2025-12-11 09:15',
          iktatoszam: 'IKT-2025-000988',
          krSzam: 'KR-440311',
          attachments: [
            { name: '2629EUD.pdf' }
          ]
        },
        {
          type: '2643TAO',
          formName: '2643TAO',
          status: 'Hiba',
          datetime: '2025-12-12 09:15',
          iktatoszam: 'IKT-2025-000989',
          krSzam: 'KR-440312',
          attachments: [
            { name: '2643TAO.pdf' }
          ]
        }
      ]
    },
    {
      icon: 'insert_drive_file',
      status: 'Lezárva',
      ugyfel: 'Tóth Éva',
      formName: '2649',
      datetime: '2026-02-02 11:05',
      unread: true,
      searchKey: 'tóth éva ikt-2026-000300 kr-450201 2629eud ikt-2026-000301 kr-450202 2643tao ikt-2026-000302 kr-450203 2649',
      items: [
        {
          type: '2629EUD',
          formName: '2629EUD',
          status: 'Beküldve',
          datetime: '2026-01-31 11:05',
          iktatoszam: 'IKT-2026-000300',
          krSzam: 'KR-450201',
          attachments: [
            { name: '2629EUD.pdf' }
          ]
        },
        {
          type: '2643TAO',
          formName: '2643TAO',
          status: 'Iktatva',
          datetime: '2026-02-01 11:05',
          iktatoszam: 'IKT-2026-000301',
          krSzam: 'KR-450202',
          attachments: [
            { name: '2643TAO.pdf' },
            { name: 'Kiegészítés 5.pdf' }
          ]
        },
        {
          type: '2649',
          formName: '2649',
          status: 'Lezárva',
          datetime: '2026-02-02 11:05',
          iktatoszam: 'IKT-2026-000302',
          krSzam: 'KR-450203',
          attachments: [
            { name: '2649.pdf' }
          ]
        }
      ]
    },
    {
      icon: 'description',
      status: 'Elfogadásra vár',
      ugyfel: 'Varga László',
      formName: '2658',
      datetime: '2026-02-02 16:20',
      unread: false,
      searchKey: 'varga lászló ikt-2026-000400 kr-450301 2650 ikt-2026-000401 kr-450302 2651 ikt-2026-000402 kr-450303 2658',
      items: [
        {
          type: '2650',
          formName: '2650',
          status: 'Beküldve',
          datetime: '2026-01-31 16:20',
          iktatoszam: 'IKT-2026-000400',
          krSzam: 'KR-450301',
          attachments: [
            { name: '2650.pdf' }
          ]
        },
        {
          type: '2651',
          formName: '2651',
          status: 'Iktatva',
          datetime: '2026-02-01 16:20',
          iktatoszam: 'IKT-2026-000401',
          krSzam: 'KR-450302',
          attachments: [
            { name: '2651.pdf' }
          ]
        },
        {
          type: '2658',
          formName: '2658',
          status: 'Elfogadásra vár',
          datetime: '2026-02-02 16:20',
          iktatoszam: 'IKT-2026-000402',
          krSzam: 'KR-450303',
          attachments: [
            { name: '2658.pdf' }
          ]
        }
      ]
    },
    {
      icon: 'description',
      ugyfel: 'Kiss Katalin',
      formName: '2620',
      datetime: '2025-11-03 08:30',
      unread: false,
      searchKey: 'kiss katalin ikt-2025-000654 kr-430118 ikt-2025-000655 kr-430119 ikt-2025-000656 kr-430120',
      items: [
        {
          formName: '2620',
          datetime: '2025-11-03 08:30',
          iktatoszam: 'IKT-2025-000654',
          krSzam: 'KR-430118',
          attachments: [
            { name: '2620.pdf' }
          ]
        },
        {
          formName: '2620',
          datetime: '2025-11-04 08:30',
          iktatoszam: 'IKT-2025-000655',
          krSzam: 'KR-430119',
          attachments: [
            { name: 'Kiegészítés 6.pdf' }
          ]
        },
        {
          formName: '2620',
          datetime: '2025-11-05 08:30',
          iktatoszam: 'IKT-2025-000656',
          krSzam: 'KR-430120',
          attachments: [
            { name: 'Kiegészítés 7.pdf' }
          ]
        }
      ]
    },
    {
      icon: 'insert_drive_file',
      ugyfel: 'Molnár Gábor',
      formName: '26251',
      datetime: '2026-01-05 12:00',
      unread: true,
      searchKey: 'molnár gábor ikt-2026-000505 kr-450505 ikt-2026-000506 kr-450506 ikt-2026-000507 kr-450507',
      items: [
        {
          formName: '26251',
          datetime: '2026-01-05 12:00',
          iktatoszam: 'IKT-2026-000505',
          krSzam: 'KR-450505',
          attachments: [
            { name: '26251.pdf' }
          ]
        },
        {
          formName: '26251',
          datetime: '2026-01-06 12:00',
          iktatoszam: 'IKT-2026-000506',
          krSzam: 'KR-450506',
          attachments: [
            { name: 'Kiegészítés 8.pdf' }
          ]
        },
        {
          formName: '26251',
          datetime: '2026-01-07 12:00',
          iktatoszam: 'IKT-2026-000507',
          krSzam: 'KR-450507',
          attachments: [
            { name: 'Kiegészítés 9.pdf' }
          ]
        }
      ]
    },
    {
      icon: 'description',
      ugyfel: 'Horváth Zsuzsanna',
      formName: '2629EUD',
      datetime: '2026-01-30 09:45',
      unread: false,
      searchKey: 'horváth zsuzsanna ikt-2026-000608 kr-450608 ikt-2026-000609 kr-450609',
      items: [
        {
          formName: '2629EUD',
          datetime: '2026-01-30 09:45',
          iktatoszam: 'IKT-2026-000608',
          krSzam: 'KR-450608',
          attachments: [
            { name: '2629EUD.pdf' }
          ]
        },
        {
          formName: '2629EUD',
          datetime: '2026-01-31 09:45',
          iktatoszam: 'IKT-2026-000609',
          krSzam: 'KR-450609',
          attachments: [
            { name: 'Kiegészítés 1.pdf' }
          ]
        }
      ]
    },
    {
      icon: 'insert_drive_file',
      ugyfel: 'Balogh István',
      formName: '2643TAO',
      datetime: '2026-02-02 09:20',
      unread: true,
      searchKey: 'balogh istván ikt-2026-000709 kr-450709 ikt-2026-000710 kr-450710',
      items: [
        {
          formName: '2643TAO',
          datetime: '2026-02-01 09:20',
          iktatoszam: 'IKT-2026-000709',
          krSzam: 'KR-450709',
          attachments: [
            { name: '2643TAO.pdf' }
          ]
        },
        {
          formName: '2643TAO',
          datetime: '2026-02-02 09:20',
          iktatoszam: 'IKT-2026-000710',
          krSzam: 'KR-450710',
          attachments: [
            { name: 'Kiegészítés 2.pdf' }
          ]
        }
      ]
    },
    {
      icon: 'description',
      ugyfel: 'Papp Mária',
      formName: '2649',
      datetime: '2026-01-15 15:00',
      unread: false,
      searchKey: 'papp mária ikt-2026-000811 kr-450811 ikt-2026-000812 kr-450812',
      items: [
        {
          formName: '2649',
          datetime: '2026-01-15 15:00',
          iktatoszam: 'IKT-2026-000811',
          krSzam: 'KR-450811',
          attachments: [
            { name: '2649.pdf' }
          ]
        },
        {
          formName: '2649',
          datetime: '2026-01-16 15:00',
          iktatoszam: 'IKT-2026-000812',
          krSzam: 'KR-450812',
          attachments: [
            { name: 'Kiegészítés 3.pdf' }
          ]
        }
      ]
    },
    {
      icon: 'insert_drive_file',
      ugyfel: 'Farkas Tamás',
      formName: '2650',
      datetime: '2026-01-28 11:10',
      unread: false,
      searchKey: 'farkas tamás ikt-2026-000913 kr-450913',
      items: [
        {
          formName: '2650',
          datetime: '2026-01-28 11:10',
          iktatoszam: 'IKT-2026-000913',
          krSzam: 'KR-450913',
          attachments: [
            { name: '2650.pdf' }
          ]
        }
      ]
    },
    {
      icon: 'description',
      ugyfel: 'Simon Andrea',
      formName: '2651',
      datetime: '2024-06-20 10:00',
      unread: false,
      searchKey: 'simon andrea ikt-2024-000045 kr-410220',
      items: [
        {
          formName: '2651',
          datetime: '2024-06-20 10:00',
          iktatoszam: 'IKT-2024-000045',
          krSzam: 'KR-410220',
          attachments: [
            { name: '2651.pdf' },
            { name: 'Kiegészítés 4.pdf' }
          ]
        }
      ]
    },
    {
      icon: 'insert_drive_file',
      status: 'Beküldve',
      ugyfel: 'Kovács János',
      formName: '2665',
      datetime: '2025-08-15 14:20',
      unread: true,
      searchKey: 'kovács jános ikt-2025-001234 kr-445678 2665',
      items: [
        {
          formName: '2665',
          status: 'Beküldve',
          datetime: '2025-08-15 14:20',
          iktatoszam: 'IKT-2025-001234',
          krSzam: 'KR-445678',
          attachments: [
            { name: '2665.pdf' }
          ]
        }
      ]
    },
    {
      icon: 'description',
      status: 'Iktatva',
      ugyfel: 'Nagy Péter',
      formName: '2671',
      datetime: '2025-09-10 09:30',
      unread: false,
      searchKey: 'nagy péter ikt-2025-001456 kr-446789 2671',
      items: [
        {
          formName: '2671',
          status: 'Iktatva',
          datetime: '2025-09-10 09:30',
          iktatoszam: 'IKT-2025-001456',
          krSzam: 'KR-446789',
          attachments: [
            { name: '2671.pdf' },
            { name: 'Kiegészítés 1.pdf' }
          ]
        }
      ]
    },
    {
      icon: 'insert_drive_file',
      status: 'Hiba',
      ugyfel: 'Molnár Gábor',
      formName: '2678',
      datetime: '2025-10-05 16:45',
      unread: true,
      searchKey: 'molnár gábor ikt-2025-001567 kr-447890 2678 ikt-2025-001568 kr-447891',
      items: [
        {
          formName: '2678',
          status: 'Beküldve',
          datetime: '2025-10-05 16:45',
          iktatoszam: 'IKT-2025-001567',
          krSzam: 'KR-447890',
          attachments: [
            { name: '2678.pdf' }
          ]
        },
        {
          formName: '2678',
          status: 'Hiba',
          datetime: '2025-10-06 16:45',
          iktatoszam: 'IKT-2025-001568',
          krSzam: 'KR-447891',
          attachments: [
            { name: 'Kiegészítés 5.pdf' }
          ]
        }
      ]
    }
  ];

  getDocuments(): Observable<DocumentItem[]> {
    return of(this.documents);
  }

  getFormNames(): string[] {
    return this.formNames.slice();
  }

  getNames(): string[] {
    return this.names.slice();
  }

  getStatuses(): string[] {
    return this.statuses.slice();
  }

  searchDocuments(query: string): DocumentItem[] {
    if (!query || !query.trim()) return [];
    const normalize = (value: string) =>
      value
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, '');
    const q = normalize(query.trim());
    return this.documents
      .filter(doc => normalize(doc.searchKey).includes(q))
      .slice(0, 8);
  }

}
