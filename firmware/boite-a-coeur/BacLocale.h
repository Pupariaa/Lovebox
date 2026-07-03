#pragma once

#if defined(ESP32)

#include <Arduino.h>
#include <string.h>

struct BacLocale {
    static char _loc[8];

    static char lbl_back[16];
    static char lbl_confirm[16];
    static char lbl_settings[20];
    static char lbl_reset[20];
    static char lbl_info[20];
    static char lbl_quit[16];
    static char lbl_wifi[12];
    static char lbl_language[16];
    static char lbl_disconnect[20];
    static char lbl_test[16];

    static char lost_title[24];
    static char lost_l1[40];
    static char lost_l2[40];
    static char lost_l3[32];
    static char lost_l4[32];
    static char lost_l5[36];
    static char lost_l6[40];
    static char splash_boot[20];
    static char welcome_l1[24];
    static char welcome_l2[32];
    static char next[12];
    static char new_message[24];
    static char new_message_ephemeral[28];
    static char ephemeral_open[28];
    static char open_msg[12];
    static char dl_app[32];
    static char dl_app2[40];
    static char bt_l1[40];
    static char bt_l2[40];
    static char bt_l3[32];
    static char bt_l4[40];
    static char bravo[12];
    static char done_l1[32];
    static char done_l2[32];
    static char wifi_err_title[32];
    static char wifi_err_hint[32];
    static char wifi_conn_title[32];
    static char wifi_conn_progress[20];
    static char idle_no_msg[32];
    static char idle_send_heart[24];
    static char disc_q1[32];
    static char disc_q2[28];
    static char disc_q3[36];
    static char disc_progress[32];
    static char disc_done[40];
    static char disc_need1[36];
    static char disc_need2[32];
    static char disc_need3[32];
    static char wifi_test_progress[40];
    static char wifi_test_ok[28];
    static char wifi_test_fail1[32];
    static char wifi_test_fail2[40];
    static char info_fw[16];
    static char info_build[12];
    static char info_model[12];
    static char info_mac[8];
    static char factory_q1[32];
    static char factory_q2[36];
    static char factory_q3[32];
    static char factory_q4[28];
    static char factory_progress[36];
    static char factory_warn[24];
    static char ota_progress[40];
    static char ota_warn[24];
    static char ota_failed[40];

    static const char *pick(const char *locale, const char *fr, const char *en, const char *es,
                            const char *pt, const char *it, const char *de) {
        if (!locale || !locale[0]) return fr;
        if (strcmp(locale, "en") == 0) return en;
        if (strcmp(locale, "es") == 0) return es;
        if (strcmp(locale, "pt") == 0) return pt;
        if (strcmp(locale, "it") == 0) return it;
        if (strcmp(locale, "de") == 0) return de;
        return fr;
    }

    static void copy(char *dst, size_t n, const char *src) {
        if (!dst || n == 0) return;
        strncpy(dst, src ? src : "", n - 1);
        dst[n - 1] = 0;
    }

    static void prepare(const char *locale) {
        copy(_loc, sizeof(_loc), locale && locale[0] ? locale : "fr");
        const char *loc = _loc;

        copy(lbl_back, sizeof(lbl_back), pick(loc, "Retour", "Back", "Volver", "Voltar", "Indietro", "Zuruck"));
        copy(lbl_confirm, sizeof(lbl_confirm), pick(loc, "Confirmer", "Confirm", "Confirmar", "Confirmar", "Conferma", "Bestatigen"));
        copy(lbl_settings, sizeof(lbl_settings), pick(loc, "Parametres", "Settings", "Ajustes", "Definicoes", "Impostazioni", "Einstellungen"));
        copy(lbl_reset, sizeof(lbl_reset), pick(loc, "Reinitialiser", "Reset", "Restablecer", "Repor", "Reimposta", "Zurucksetzen"));
        copy(lbl_info, sizeof(lbl_info), pick(loc, "Informations", "Information", "Informacion", "Informacao", "Informazioni", "Informationen"));
        copy(lbl_quit, sizeof(lbl_quit), pick(loc, "Quitter", "Exit", "Salir", "Sair", "Esci", "Beenden"));
        copy(lbl_wifi, sizeof(lbl_wifi), "WiFi");
        copy(lbl_language, sizeof(lbl_language), pick(loc, "Langue", "Language", "Idioma", "Idioma", "Lingua", "Sprache"));
        copy(lbl_disconnect, sizeof(lbl_disconnect), pick(loc, "Deconnecter", "Disconnect", "Desconectar", "Desligar", "Disconnetti", "Trennen"));
        copy(lbl_test, sizeof(lbl_test), pick(loc, "Tester", "Test", "Probar", "Testar", "Testa", "Testen"));

        copy(lost_title, sizeof(lost_title), pick(loc, "Connexion perdue", "Connection lost", "Conexion perdida", "Ligacao perdida", "Connessione persa", "Verbindung verloren"));
        copy(lost_l1, sizeof(lost_l1), pick(loc, "La connexion a internet a echoue", "Internet connection failed", "Fallo la conexion a internet", "Falha na ligacao a internet", "Connessione internet fallita", "Internetverbindung fehlgeschlagen"));
        copy(lost_l2, sizeof(lost_l2), pick(loc, "Votre boite a coeur ne parvient", "Your Lovebox cannot", "Tu caja no puede", "A tua caixa nao consegue", "La tua scatola non riesce", "Deine Box kann sich nicht"));
        copy(lost_l3, sizeof(lost_l3), pick(loc, "pas a se connecter", "connect to the internet", "conectarse a internet", "ligar-se a internet", "connettersi a internet", "mit dem Internet verbinden"));
        copy(lost_l4, sizeof(lost_l4), pick(loc, "a internet", "right now", "ahora", "agora", "adesso", "verbinden"));
        copy(lost_l5, sizeof(lost_l5), pick(loc, "Verifiez la configuration", "Check settings in the app", "Revisa la configuracion", "Verifica a configuracao", "Controlla le impostazioni", "Prufe die Einstellungen"));
        copy(lost_l6, sizeof(lost_l6), pick(loc, "depuis l'application Boite a Coeur", "in the Boite a Coeur app", "en la app Boite a Coeur", "na app Boite a Coeur", "nell'app Boite a Coeur", "in der Boite a Coeur App"));

        copy(splash_boot, sizeof(splash_boot), pick(loc, "Demarrage...", "Starting...", "Iniciando...", "A iniciar...", "Avvio...", "Start..."));
        copy(welcome_l1, sizeof(welcome_l1), pick(loc, "Bienvenue dans", "Welcome to", "Bienvenido a", "Bem-vindo a", "Benvenuto nella", "Willkommen in"));
        copy(welcome_l2, sizeof(welcome_l2), pick(loc, "votre boite a coeur !", "your Lovebox!", "tu caja del corazon!", "a tua caixa do coracao!", "tua scatola del cuore!", "deiner Herzensbox!"));
        copy(next, sizeof(next), pick(loc, "Suivant", "Next", "Siguiente", "Seguinte", "Avanti", "Weiter"));
        copy(new_message, sizeof(new_message), pick(loc, "Nouveau message", "New message", "Nuevo mensaje", "Nova mensagem", "Nuovo messaggio", "Neue Nachricht"));
        copy(new_message_ephemeral, sizeof(new_message_ephemeral), pick(loc, "Message \xC3\xA9ph\xC3\xA9m\xC3\xA8re", "Ephemeral message", "Mensaje ef\xC3\xADmero", "Mensagem ef\xC3\xA9mera", "Messaggio efimero", "Fl\xC3\xBCchtige Nachricht"));
        copy(ephemeral_open, sizeof(ephemeral_open), pick(loc, "10 sec · Ouvrir", "10 sec · Open", "10 seg · Abrir", "10 seg · Abrir", "10 sec · Apri", "10 Sek · Offnen"));
        copy(open_msg, sizeof(open_msg), pick(loc, "Ouvrir", "Open", "Abrir", "Abrir", "Apri", "Offnen"));
        copy(dl_app, sizeof(dl_app), pick(loc, "Telechargez l'application", "Download the app", "Descarga la aplicacion", "Transfere a aplicacao", "Scarica l'app", "Lade die App herunter"));
        copy(dl_app2, sizeof(dl_app2), pick(loc, "pour configurer votre boite", "to set up your Lovebox", "para configurar tu caja", "para configurar a caixa", "per configurare la scatola", "um deine Box einzurichten"));
        copy(bt_l1, sizeof(bt_l1), pick(loc, "Activez le Bluetooth", "Turn on Bluetooth", "Activa el Bluetooth", "Ativa o Bluetooth", "Attiva il Bluetooth", "Bluetooth einschalten"));
        copy(bt_l2, sizeof(bt_l2), pick(loc, "sur votre smartphone", "on your phone", "en tu telefono", "no telemovel", "sul telefono", "auf dem Smartphone"));
        copy(bt_l3, sizeof(bt_l3), pick(loc, "et connectez-vous a", "and connect to", "y conectate a", "e liga-te a", "e connettiti a", "und verbinde dich mit"));
        copy(bt_l4, sizeof(bt_l4), pick(loc, "Poursuivez sur le smartphone", "Continue on your phone", "Continua en el telefono", "Continua no telemovel", "Continua sul telefono", "Weiter auf dem Smartphone"));
        copy(bravo, sizeof(bravo), pick(loc, "Bravo !", "Done!", "Listo!", "Pronto!", "Fatto!", "Fertig!"));
        copy(done_l1, sizeof(done_l1), pick(loc, "Votre boite a coeur est", "Your Lovebox is", "Tu caja esta", "A tua caixa esta", "La tua scatola e", "Deine Box ist"));
        copy(done_l2, sizeof(done_l2), pick(loc, "desormais configuree", "now configured", "configurada", "configurada", "configurata", "jetzt eingerichtet"));
        copy(wifi_err_title, sizeof(wifi_err_title), pick(loc, "Connexion impossible a", "Cannot connect to", "No se puede conectar a", "Nao foi possivel ligar a", "Impossibile connettersi a", "Verbindung fehlgeschlagen mit"));
        copy(wifi_err_hint, sizeof(wifi_err_hint), pick(loc, "Verifiez vos parametres", "Check your settings", "Revisa los ajustes", "Verifica as definicoes", "Controlla le impostazioni", "Prufe die Einstellungen"));
        copy(wifi_conn_title, sizeof(wifi_conn_title), pick(loc, "Connexion au WiFi", "Connecting to WiFi", "Conectando al WiFi", "A ligar ao WiFi", "Connessione WiFi", "WiFi-Verbindung"));
        copy(wifi_conn_progress, sizeof(wifi_conn_progress), pick(loc, "en cours...", "in progress...", "en curso...", "a ligar...", "in corso...", "lauft..."));
        copy(idle_no_msg, sizeof(idle_no_msg), pick(loc, "Pas de nouveau message", "No new message", "Sin mensajes nuevos", "Sem novas mensagens", "Nessun nuovo messaggio", "Keine neue Nachricht"));
        copy(idle_send_heart, sizeof(idle_send_heart), pick(loc, "Envoyer un coeur", "Send a heart", "Enviar un corazon", "Enviar um coracao", "Invia un cuore", "Herz senden"));
        copy(disc_q1, sizeof(disc_q1), pick(loc, "Voulez-vous vraiment", "Do you really want", "Realmente quieres", "Queres mesmo", "Vuoi davvero", "Mochtest du wirklich"));
        copy(disc_q2, sizeof(disc_q2), pick(loc, "deconnecter votre", "to disconnect your", "desconectar tu", "desligar a tua", "disconnettere la tua", "deine Box vom"));
        copy(disc_q3, sizeof(disc_q3), pick(loc, "Boite a coeur ?", "Lovebox?", "caja?", "caixa?", "scatola?", "Internet trennen?"));
        copy(disc_progress, sizeof(disc_progress), pick(loc, "Deconnexion...", "Disconnecting...", "Desconectando...", "A desligar...", "Disconnessione...", "Trenne..."));
        copy(disc_done, sizeof(disc_done), pick(loc, "Boite deconnectee", "Lovebox disconnected", "Caja desconectada", "Caixa desligada", "Scatola disconnessa", "Box getrennt"));
        copy(disc_need1, sizeof(disc_need1), pick(loc, "Pour utiliser la boite,", "To use the Lovebox,", "Para usar la caja,", "Para usar a caixa,", "Per usare la scatola,", "Um die Box zu nutzen,"));
        copy(disc_need2, sizeof(disc_need2), pick(loc, "vous devez configurer", "you need an internet", "necesitas una", "precisas de uma", "serve una connessione", "brauchst du eine"));
        copy(disc_need3, sizeof(disc_need3), pick(loc, "une connexion internet.", "connection.", "conexion a internet.", "ligacao a internet.", "internet.", "Internetverbindung."));
        copy(wifi_test_progress, sizeof(wifi_test_progress), pick(loc, "Test de connexion...", "Testing connection...", "Probando conexion...", "A testar ligacao...", "Test connessione...", "Verbindungstest..."));
        copy(wifi_test_ok, sizeof(wifi_test_ok), pick(loc, "Connexion parfaite !", "Connection OK!", "Conexion perfecta!", "Ligacao perfeita!", "Connessione OK!", "Verbindung OK!"));
        copy(wifi_test_fail1, sizeof(wifi_test_fail1), pick(loc, "Serveurs injoignables", "Cannot reach servers", "Servidores inaccesibles", "Servidores inacessiveis", "Server non raggiungibili", "Server nicht erreichbar"));
        copy(wifi_test_fail2, sizeof(wifi_test_fail2), pick(loc, "Reessayez plus tard", "Try again later", "Intentalo mas tarde", "Tenta mais tarde", "Riprova piu tardi", "Spater erneut versuchen"));
        copy(info_fw, sizeof(info_fw), pick(loc, "Version FW:", "FW version:", "Version FW:", "Versao FW:", "Versione FW:", "FW-Version:"));
        copy(info_build, sizeof(info_build), pick(loc, "Build:", "Build:", "Build:", "Build:", "Build:", "Build:"));
        copy(info_model, sizeof(info_model), pick(loc, "Modele:", "Model:", "Modelo:", "Modelo:", "Modello:", "Modell:"));
        copy(info_mac, sizeof(info_mac), pick(loc, "MAC:", "MAC:", "MAC:", "MAC:", "MAC:", "MAC:"));
        copy(factory_q1, sizeof(factory_q1), pick(loc, "Reinitialiser la boite ?", "Reset the Lovebox?", "Restablecer la caja?", "Repor a caixa?", "Reimpostare la scatola?", "Box zurucksetzen?"));
        copy(factory_q2, sizeof(factory_q2), pick(loc, "Le prochain demarrage", "Next boot will show", "El proximo inicio", "O proximo arranque", "Al prossimo avvio", "Beim nachsten Start"));
        copy(factory_q3, sizeof(factory_q3), pick(loc, "affichera le setup", "the setup wizard", "mostrara el setup", "mostra o setup", "mostrera il setup", "erscheint das Setup"));
        copy(factory_q4, sizeof(factory_q4), pick(loc, "initial.", "again.", "inicial.", "inicial.", "iniziale.", "erneut."));
        copy(factory_progress, sizeof(factory_progress), pick(loc, "Reinitialisation...", "Resetting...", "Restableciendo...", "A repor...", "Reimpostazione...", "Zurucksetzen..."));
        copy(factory_warn, sizeof(factory_warn), pick(loc, "Ne pas debrancher", "Do not unplug", "No desenchufar", "Nao desligar", "Non scollegare", "Nicht trennen"));
        copy(ota_progress, sizeof(ota_progress), pick(loc, "Mise a jour en cours..", "Update in progress..", "Actualizacion en curso..", "Atualizacao em curso..", "Aggiornamento...", "Update lauft.."));
        copy(ota_warn, sizeof(ota_warn), pick(loc, "Ne pas debrancher", "Do not unplug", "No desenchufar", "Nao desligar", "Non scollegare", "Nicht trennen"));
        copy(ota_failed, sizeof(ota_failed), pick(loc, "Echec mise a jour", "Update failed", "Actualizacion fallida", "Atualizacao falhou", "Aggiornamento fallito", "Update fehlgeschlagen"));
    }

    static const char *locale() { return _loc; }

    static const char *dayName(int wday) {
        static const char *days_fr[] = {"Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"};
        static const char *days_en[] = {"Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"};
        static const char *days_es[] = {"Domingo", "Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado"};
        static const char *days_pt[] = {"Domingo", "Segunda", "Terca", "Quarta", "Quinta", "Sexta", "Sabado"};
        static const char *days_it[] = {"Domenica", "Lunedi", "Martedi", "Mercoledi", "Giovedi", "Venerdi", "Sabato"};
        static const char *days_de[] = {"Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"};
        if (wday < 0 || wday > 6) wday = 0;
        if (strcmp(_loc, "en") == 0) return days_en[wday];
        if (strcmp(_loc, "es") == 0) return days_es[wday];
        if (strcmp(_loc, "pt") == 0) return days_pt[wday];
        if (strcmp(_loc, "it") == 0) return days_it[wday];
        if (strcmp(_loc, "de") == 0) return days_de[wday];
        return days_fr[wday];
    }

    static const char *monthName(int mon) {
        static const char *months_fr[] = {"Janvier", "Fevrier", "Mars", "Avril", "Mai", "Juin", "Juillet", "Aout", "Septembre", "Octobre", "Novembre", "Decembre"};
        static const char *months_en[] = {"January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"};
        static const char *months_es[] = {"Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"};
        static const char *months_pt[] = {"Janeiro", "Fevereiro", "Marco", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"};
        static const char *months_it[] = {"Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"};
        static const char *months_de[] = {"Januar", "Februar", "Marz", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"};
        if (mon < 0 || mon > 11) mon = 0;
        if (strcmp(_loc, "en") == 0) return months_en[mon];
        if (strcmp(_loc, "es") == 0) return months_es[mon];
        if (strcmp(_loc, "pt") == 0) return months_pt[mon];
        if (strcmp(_loc, "it") == 0) return months_it[mon];
        if (strcmp(_loc, "de") == 0) return months_de[mon];
        return months_fr[mon];
    }
};

char BacLocale::_loc[8] = "fr";
char BacLocale::lbl_back[16] = "Retour";
char BacLocale::lbl_confirm[16] = "Confirmer";
char BacLocale::lbl_settings[20] = "Parametres";
char BacLocale::lbl_reset[20] = "Reinitialiser";
char BacLocale::lbl_info[20] = "Informations";
char BacLocale::lbl_quit[16] = "Quitter";
char BacLocale::lbl_wifi[12] = "WiFi";
char BacLocale::lbl_language[16] = "Langue";
char BacLocale::lbl_disconnect[20] = "Deconnecter";
char BacLocale::lbl_test[16] = "Tester";
char BacLocale::lost_title[24] = "";
char BacLocale::lost_l1[40] = "";
char BacLocale::lost_l2[40] = "";
char BacLocale::lost_l3[32] = "";
char BacLocale::lost_l4[32] = "";
char BacLocale::lost_l5[36] = "";
char BacLocale::lost_l6[40] = "";
char BacLocale::splash_boot[20] = "";
char BacLocale::welcome_l1[24] = "";
char BacLocale::welcome_l2[32] = "";
char BacLocale::next[12] = "";
char BacLocale::new_message[24] = "";
char BacLocale::new_message_ephemeral[28] = "";
char BacLocale::ephemeral_open[28] = "";
char BacLocale::open_msg[12] = "";
char BacLocale::dl_app[32] = "";
char BacLocale::dl_app2[40] = "";
char BacLocale::bt_l1[40] = "";
char BacLocale::bt_l2[40] = "";
char BacLocale::bt_l3[32] = "";
char BacLocale::bt_l4[40] = "";
char BacLocale::bravo[12] = "";
char BacLocale::done_l1[32] = "";
char BacLocale::done_l2[32] = "";
char BacLocale::wifi_err_title[32] = "";
char BacLocale::wifi_err_hint[32] = "";
char BacLocale::wifi_conn_title[32] = "";
char BacLocale::wifi_conn_progress[20] = "";
char BacLocale::idle_no_msg[32] = "";
char BacLocale::idle_send_heart[24] = "";
char BacLocale::disc_q1[32] = "";
char BacLocale::disc_q2[28] = "";
char BacLocale::disc_q3[36] = "";
char BacLocale::factory_q1[32] = "";
char BacLocale::factory_q2[36] = "";
char BacLocale::factory_q3[32] = "";
char BacLocale::factory_q4[28] = "";
char BacLocale::factory_progress[36] = "";
char BacLocale::factory_warn[24] = "";
char BacLocale::ota_progress[40] = "";
char BacLocale::ota_warn[24] = "";
char BacLocale::ota_failed[40] = "";
char BacLocale::disc_progress[32] = "";
char BacLocale::disc_done[40] = "";
char BacLocale::disc_need1[36] = "";
char BacLocale::disc_need2[32] = "";
char BacLocale::disc_need3[32] = "";
char BacLocale::wifi_test_progress[40] = "";
char BacLocale::wifi_test_ok[28] = "";
char BacLocale::wifi_test_fail1[32] = "";
char BacLocale::wifi_test_fail2[40] = "";
char BacLocale::info_fw[16] = "";
char BacLocale::info_build[12] = "";
char BacLocale::info_model[12] = "";
char BacLocale::info_mac[8] = "";

#else

struct BacLocale {
    static void prepare(const char *) {}
    static const char *locale() { return "fr"; }
    static const char *dayName(int) { return ""; }
    static const char *monthName(int) { return ""; }
};

#endif
