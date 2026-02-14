import { Injectable } from '@angular/core';

export interface MenuSubmenu {
  title: string;
  items: string[];
}

export interface MenuNode {
  title: string;
  submenus: MenuSubmenu[];
  items: string[];
}

const RAW_MENU = `
Részletes keresés (főmenü) (pls. put search icon right hand side)
Ügyféliránytű (főmenü)
Adókulcsok, járulékmértékek (sub fomenu)
Adótáblák
Áfakulcsok, tárgyi adómentes tevékenységek
EHO 2011-2018
Fizetendő járulékok
Illetékmértékek
Minimálbér, garantált bérminimum
Szociális hozzájárulási adó
Valorizált adómértékek
Adónaptár (sub fomenu)
Általános adónaptár
Élethelyzetek adózása (sub fomenu)
Kezdeti teendők
Diákévek
Munka
Család
Vagyonügyek
Vállalkozás
Nyugdíjas évek
Öröklés
Ügyintézési kisokos
Adótraffipax (sub fomenu)
Árverések (sub fomenu)
Árverések - hagyományos
Árverések - elektronikus
Tájékoztatás az EÁF üzemszüneteiről
Földárverési hirdetmények
Eljárási kérdések (sub fomenu)
Ha levelet kap a NAV-tól (sub fomenu)
Határátkelőhelyi várakozások (sub fomenu)
Jegybanki alapkamat (sub fomenu)
Kalkulátorok (sub fomenu)
Családi adókedvezmény-kalkulátor 2026-2029
Családikedvezmény-kalkulátorok
Gépjárműadó-kalkulátor
Ingatlanértékesítés
Késedelmi kamat számítása
Kivakalkulátor
Pótlékszámítás
Regisztrációs adó kalkulátor
Tevékenységlekérdező
Vállalkozói kalkulátor
Közérdekű bejelentés, panasz, Uniós/hazai támogatásokkal visszaélés (sub fomenu)
Közösségi adószámok megerősítése (sub fomenu)
Keressen minket! (sub fomenu)
Lépésről lépésre (sub fomenu)
Mentor Program (sub fomenu)
NAV Online (sub fomenu)
Nézzen utána! (sub fomenu)
Adópercek
Információs füzetek
Ingatlan-adásvétel
Könnyítések (Covid)
Tudjon róla! Segíthet!
Utastájékoztató
Webes rendelés
Számlaszámok a befizetéshez (sub fomenu)
Személyes adónaptár (sub fomenu)
Ügyfélszolgálati időpont foglalása (sub fomenu)
Ügyfélszolgálatok (sub fomenu)
Ügykatalógus (dokumentumtípusok) (sub fomenu)
Üzemanyag-elszámolás (sub fomenu)
Válaszol a NAV (sub fomenu)
Háromgyerekes anyák kedvezménye
Az egyszerűsített foglalkoztatás változásai 2025-ben
Online Számla eltérés
Állandó meghatalmazás
ÁNYK - eBEV
Cégkapu
Egyéb
E-kereskedelem
Fémkereskedelem
Új kata
Gépjárműadó
Jövedéki adó
Mentor Program
Vállalkozóknak
Adatbázisok (főmenü)
Adóhiányosok, hátralékosok, végrehajtás alattiak (sub fomenu)
Adóhiányosok, hátralékosok
Nagy összegű adóhiányosok adatbázisa
Archív listák (Art. 264. §)
Végrehajtási eljárás alatt álló adózók listája
Adatszolgáltatás vámadatbázisokból (sub fomenu)
Adóalanyok lekérdezése (sub fomenu)
Áfaalanyok
Csoportos áfaalanyok
Egyéni vállalkozók bevallási adatai
Egyéni vállalkozók nyilvántartása
Áfabevallást be nem nyújtó adózók
Egyéb szervezetek
Fészekrakó program
Ingatlannal rendelkező társaságok
Minősített adózók
Szabályozott ingatlanbefektetési társaságok
Tevékenységlekérdező
FATCA pénzügyi intézmények
Aktv. 43/G. § szerinti pénzügyi intézmények
Adóstatisztikák (sub fomenu)
Afad tv. szerinti bizonytalan és megbízhatatlan adatszolgáltatók (sub fomenu)
Alkalmazottat bejelentés nélkül foglalkoztatók (sub fomenu)
Automata berendezések adatai (sub fomenu)
Bejelentkezési kötelezettségüket elmulasztó adózók (sub fomenu)
Dohánygyártmányok kiskereskedelmi ára (sub fomenu)
Engedélyes és nyilvántartott jövedéki alanyok (sub fomenu)
Felfüggesztett adószámok (sub fomenu)
Kézbesítési fikcióval érintett elektronikus iratok (sub fomenu)
Kézbesítési fikcióval érintett papíralapú iratok (sub fomenu)
Közreműködő szervezetek névjegyzéke (sub fomenu)
Köztartozásmentes adózók (sub fomenu)
Egyszerű lekérdezés
Csoportos adószám-lekérdezés
Megbízható adózók (sub fomenu)
Műszerészi igazolványok, plombanyomók (sub fomenu)
Érvényes műszerészi igazolványok, plombanyomók
Érvénytelen műszerészi igazolványok, plombanyomók
Nyomdai sorszámintervallumok (sub fomenu)
Pénztárgép- és taxaméterszervizek (sub fomenu)
Nyilvántartásba vett szervizek
Törölt szervizek
Pénzügyi számlákkal kapcsolatos adatszolgáltatás (sub fomenu)
Reklámadóról szóló törvény szerinti nyilvántartás (sub fomenu)
Szankciós jelleggel törölt adószámok (sub fomenu)
Hirdetmények a szankciós adószám-törlésekről
Szankciós jelleggel törölt adószámok
Több adatbázis együttes lekérdezése (sub fomenu)
Utólagos adófizetésben közreműködő bankok (sub fomenu)
Nyomtatványok (főmenü)
Nyomtatványok (sub fomenu)
Nyomtatványkereső
ÁNYK keretprogram
Pénzintézetek számlaszám adatszolgáltatása
Elektronikus benyújtás
Online Nyomtatványkitöltő Alkalmazás (sub fomenu)
Letöltések - egyéb (sub fomenu)
Adatlapok, igazolások, meghatalmazásminták
Tájékoztatók az adatszolgáltatáshoz
Nyomtatványtervezetek
ONYA segédletek
E-bevallás, Java (sub fomenu)
Általános tudnivalók az e-bevallásról
ÁNYK-AbevJava kitöltőprogram
Fejlesztőknek
Adó (főmenü)
Adókonzultáció (sub fomenu)
Adószámla (sub fomenu)
Élethelyzetek adózása (sub fomenu)
Kezdeti teendők
Diákévek
Munka
Család
Vagyonügyek
Vállalkozás
Nyugdíjas évek
Öröklés
Ügyintézési kisokos
Adózás rendje (sub fomenu)
Adózási kérdés (sub fomenu)
Adóelőleg-nyilatkozat (sub fomenu)
Személyi jövedelemadó (sub fomenu)
Illetékek (sub fomenu)
Ingatlan-adásvétel (sub fomenu)
Gépjárműadó (sub fomenu)
Szociális hozzájárulási adó (sub fomenu)
Egészségügyi szolgáltatási járulék (sub fomenu)
eÁFA (sub fomenu)
Társadalombiztosítás (sub fomenu)
eNyugta (sub fomenu)
Társasági adó (sub fomenu)
Kisvállalati adó (kiva) (sub fomenu)
2022. augusztus 31-ig katás voltam (sub fomenu)
Új kata (sub fomenu)
Régi kata (sub fomenu)
Általános forgalmi adó (sub fomenu)
Megállapodások, egyezségek (sub fomenu)
Szja 1+1% (sub fomenu)
1+1%-os rendelkezés 2026-ban
Felajánlásra jogosultak
Kizárt civil szervezetek 2026
Tájékoztatók
Kimutatások és elszámolások
Egyéb kötelezettség és költségvetési támogatás (sub fomenu)
OSS belépés (sub fomenu)
Online pénztárgépek (sub fomenu)
Jövedéki adó (sub fomenu)
Jövedéki nyomtatványok
EMCS
Jogszabályok
Tájékoztatók, információk
Egyéb (sub fomenu)
CESOP (sub fomenu)
Vendégéjszakák száma (sub fomenu)
SME - Kisvállalkozások Közösségi Alanyi Adómentességi Rendszere (sub fomenu)
TADEUS (sub fomenu)
Piacfelügyelet (sub fomenu)
Vám (főmenü)
Áruosztályozás (sub fomenu)
Behozatal (sub fomenu)
Brexit (sub fomenu)
Egységes vámokmány kitöltési útmutatója (sub fomenu)
Engedélyezés, AEO-k (sub fomenu)
E-kereskedelem (webes rendelés) (sub fomenu)
EORI-szám (sub fomenu)
Felderítési eredmények (sub fomenu)
Fémkereskedelem (sub fomenu)
Határátkelőhelyi kamerák (sub fomenu)
Határforgalom (sub fomenu)
Kivitel (sub fomenu)
Nem kereskedelmi (utas) forgalom (sub fomenu)
Magyar-ukrán határ - szankciós információk (sub fomenu)
Regisztrációs adó (sub fomenu)
Származás (sub fomenu)
Szellemi tulajdonjogok védelme (sub fomenu)
Utastájékoztató (sub fomenu)
Vámérték (sub fomenu)
Váminformatikai fejlesztések (sub fomenu)
Vámfizetés (sub fomenu)
Vámudvarok (sub fomenu)
Egyéb (sub fomenu)
Bűnügy (főmenü)
Elérhetőségek (sub fomenu)
Eredményeink (sub fomenu)
Szervezet (sub fomenu)
MERKUR Bevetési Egység (sub fomenu)
e-Papír (sub fomenu)
Kapcsolat (főmenü)
Keressen minket
Igazgatosagok
Ügyfélszolgálatok
Együttműködő szervek
Sajtószoba
MIMCS (főmenü)
Élethelyzetek adózása (főmenü)
Kik vagyunk? (főmenü)
Szabályzók (főmenü)
Szabályzatok (sub főmenü)
Utasítások (sub főmenü)
Útmutatók (sub főmenü)
Tájékoztatások (sub főmenü)
Kiadványok (főmenü)
Mi vagyunk a NAV (sub főmenü)
Évkönyvek (sub főmenü)
Jubileumi kiadványok (sub főmenü)
Stratégia 2021-2024 (sub főmenü)
Röviden, egyszerűen (sub főmenü)
Utastájékoztató (sub főmenü)
Utastájékoztató
Travel Guides
Információk az EU határain kívül és belül
Konténeres vámkezelés (sub főmenü)
A NAV nyomozó hatósága (sub főmenü)
Adóvilág (sub főmenü)
Adóvilág 2023
Adóvilág 2022
Adóvilág 2021
Adóvilág 2020
Adóvilág 2019
Adóvilág 2018
Adóvilág 2017
Közérthetőségi kiadványok (sub főmenü)
Hirdetmények (főmenü)
Anonimizált határozatok (főmenü)
Európai Uniós projektek (főmenü)
Pénzmosás (főmenü)
OLAF (főmenü)
Bemutatkozás (sub főmenü)
OLAF Koordinációs Iroda (sub főmenü)
Szakértői tevékenység (sub főmenü)
Hírek (sub főmenü)
Szabályozási háttér (sub főmenü)
Dokumentumtár (sub főmenü)
Hasznos linkek (sub főmenü)
Elérhetőségek (sub főmenü)
Rendezvények (főmenü)
Elveszett okmányok (főmenü)
Oktatás (főmenü)
Múzeum (főmenü)
Múzeumtörténet (sub főmenü)
Digitális gyűjtemény (sub főmenü)
Múzeumpedagógia (sub főmenü)
Elérhetőség (sub főmenü)
Publikációk (sub főmenü)
Eseménynaptár (sub főmenü)
Múzeumbusz (főmenü)
Zenekar (főmenü)
Bemutatkozás (sub főmenü)
Zenei vezetők (sub főmenü)
Zenekari formációk (sub főmenü)
Koncertkalendárium (sub főmenü)
Kiadványok (sub főmenü)
Elérhetőség (sub főmenü)
Egyenruházat (főmenü)
`;

@Injectable({ providedIn: 'root' })
export class KezdolapMenuService {
  private readonly menu = this.parseMenu(RAW_MENU);

  getMenu(): MenuNode[] {
    return this.menu;
  }

  private parseMenu(raw: string): MenuNode[] {
    const lines = raw
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);

    const menus: MenuNode[] = [];
    let currentMenu: MenuNode | null = null;
    let currentSubmenu: MenuSubmenu | null = null;

    const isMainMenu = (line: string): boolean => line.includes('(főmenü)');
    const isSubMenu = (line: string): boolean =>
      line.includes('(sub fomenu)') || line.includes('(sub főmenü)');
    const stripMain = (line: string): string => line.split('(főmenü)')[0].trim();
    const stripSub = (line: string): string =>
      line
        .replace('(sub fomenu)', '')
        .replace('(sub főmenü)', '')
        .trim();

    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];

      if (isMainMenu(line)) {
        const title = stripMain(line);
        currentMenu = {
          title,
          submenus: [],
          items: []
        };
        menus.push(currentMenu);
        currentSubmenu = null;
        continue;
      }

      if (isSubMenu(line)) {
        if (!currentMenu) {
          continue;
        }

        const title = stripSub(line);
        const nextLine = lines[i + 1];
        if (!nextLine || isMainMenu(nextLine) || isSubMenu(nextLine)) {
          currentMenu.items.push(`${title} menu item`);
          currentSubmenu = null;
          continue;
        }

        currentSubmenu = {
          title,
          items: []
        };
        currentMenu.submenus.push(currentSubmenu);
        continue;
      }

      if (currentSubmenu) {
        currentSubmenu.items.push(line);
      } else if (currentMenu) {
        currentMenu.items.push(line);
      }
    }

    menus.forEach(menu => {
      if (menu.submenus.length === 0 && menu.items.length === 0) {
        menu.title = `${menu.title} menu item`;
      }
    });

    return menus;
  }
}
