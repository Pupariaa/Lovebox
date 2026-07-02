#ifndef PROJET_H
#define PROJET_H

#include <Lucarne.h>
#include "Projet_fonts.h"
#include "Projet_images.h"
#include "Projet_icons.h"
#include "Projet_setup.h"

using namespace lucarne;

// Menu actions — read in loop() with ui.pollMenuAction() (constants below)
static const uint8_t ACTION_SETTINGS_DISCONNECT_CONFIRM = 1;

inline uint8_t pollMenuAction(UI &ui) { return ui.pollMenuAction(); }

namespace projet {

// ---- Widgets ----
Label w0(1, 12, "Connexion perdue", TextAlign::Left);
Label w1(0, 40, "La connexion à internet a échouée", TextAlign::Left);
Icon w2(106, 66, "emoji:1f329-fe0f", 2);
Label w3(0, 128, "il semblerais que votre boîte à coeur", TextAlign::Left);
Label w4(0, 148, "ne parvienne pas à se ", TextAlign::Left);
Label w5(0, 163, "connecter à internet", TextAlign::Left);
Label w6(0, 189, "Vérifiez la configuration", TextAlign::Left);
Label w7(0, 209, "depuis l'application Boite à Coeur", TextAlign::Left);
Label w8(0, 51, "Boite", TextAlign::Left);
Label w9(0, 208, "Démarrage...", TextAlign::Left);
Label w10(0, 100, "à", TextAlign::Left);
Label w11(0, 133, "Coeur", TextAlign::Left);
Label w12(0, 79, "Bienvenue dans", TextAlign::Left);
Label w13(0, 105, "votre boite à coeur !", TextAlign::Left);
Icon w14(100, 144, "emoji:1f44b-1f3fb", 24);
Label w15(0, 30, "Suivant", TextAlign::Left);
Icon w16(120, 0, "emoji:1f446-1f3fb@w:w_mqzwk1a2f", 1);
Image w17(0, 0, 280, 240, &Img_img_mqxqcdzu6);
Label w18(0, 69, "Nouveau message", TextAlign::Left);
Icon w19(76, 109, "emoji:1f48c", 4);
Label w20(0, 22, "Ouvrir", TextAlign::Left);
Icon w21(126, 4, "emoji:1f446", 9);
Label w22(0, 50, "Téléchargez l'application", TextAlign::Left);
Label w23(0, 74, "pour configurer votre boîte à coeur", TextAlign::Left);
Image w24(88, 104, 104, 104, &Img_img_mqzwhl42d);
Label w25(0, 30, "Suivant", TextAlign::Left);
Icon w26(121, 2, "emoji:1f446-1f3fb@w:w_mqzwncruk", 1);
Label w27(0, 115, "et connectez vous à ", TextAlign::Left);
Label w28(0, 100, "Une fois installée, activez le Bluetooth", TextAlign::Left);
Label w29(0, 152, "device_bt_name", TextAlign::Left);
Image w30(120, 24, 40, 56, &Img_img_mqzx0357u);
Label w31(0, 195, "Et poursuivez sur votre smartphone", TextAlign::Left);
Label w32(0, 15, "Bravo !", TextAlign::Left);
Icon w33(104, 80, "emoji:1f389@w:w_mqzx3u1111", 24);
Label w34(0, 165, "Votre boîte à coeur est ", TextAlign::Left);
Label w35(0, 190, "désormais configurée", TextAlign::Left);
Label w36(0, 23, "Impossible de se connecter à", TextAlign::Left);
Label w37(0, 61, "SSID_name", TextAlign::Left);
Label w38(0, 190, "Vérifiez vos paramètres", TextAlign::Left);
Icon w39(107, 90, "emoji:1f614@w:w_mqzxkguj1c", 2);
Label w40(0, 39, "Connexion au réseau wifi", TextAlign::Left);
Label w41(0, 67, "SSID_name", TextAlign::Left);
Label w42(0, 91, "en cours..", TextAlign::Left);
Icon w43(103, 122, "emoji:1f42c@w:w_mqzxq5g01i", 24);
Label w44(0, 93, "23:59", TextAlign::Left);
Label w45(0, 201, "Pas de nouveau message", TextAlign::Left);
Label w46(0, 34, "Envoyer un coeur", TextAlign::Left);
Icon w47(126, 2, "emoji:1f446-1f3fb@w:w_mqzydtu11n", 1);
Label w48(0, 147, "JJ jj aaaa", TextAlign::Left);
Menu w49(40, 48, 199, 157);
Menu w50(40, 48, 199, 157);
Menu w51(40, 83, 199, 157);
Label w52(0, 37, "SSID_name", TextAlign::Left);
Label w53(0, 0, "Paramètre disponible", TextAlign::Left);
Label w54(0, 55, "que depuis l'application", TextAlign::Left);
Menu w55(40, 83, 199, 157);
Menu w56(40, 141, 199, 61);
Label w57(0, 29, "Souhaitez vous vraiment", TextAlign::Left);
Label w58(0, 52, "déconnecter votre", TextAlign::Left);
Label w59(0, 73, "Boîte à coeur d'internet ?", TextAlign::Left);
Label w60(0, 27, "Déconnexion en cours...", TextAlign::Left);
Icon w61(104, 88, "emoji:1f42c@w:w_mr17v20xe", 2);
Label w62(0, 47, "La Boîte à coeur a été déconnectée", TextAlign::Left);
Label w63(0, 106, "Pour utiliser la Boîte à coeur, ", TextAlign::Left);
Label w64(0, 124, "Vous devez spécifier une", TextAlign::Left);
Label w65(0, 142, "connexion internet.", TextAlign::Left);
Menu w66(40, 189, 199, 35);
Label w67(0, 25, "Test de la connexion en cours...", TextAlign::Left);
Icon w68(104, 88, "emoji:1f42c@w:w_mr17ug4qc", 2);
Icon w69(96, 74, "emoji:1f389@w:w_mr16c6451w", 28);
Label w70(0, 34, "Connexion parfaite !", TextAlign::Left);
Menu w71(40, 189, 199, 35);
Icon w72(108, 88, "emoji:1f614@w:w_mr16e7f01z", 2);
Label w73(0, 34, "Aie... Impossible de joindre", TextAlign::Left);
Label w74(0, 55, "les serveurs.. Réessayez plus tard", TextAlign::Left);
Menu w75(40, 189, 199, 35);
Label w76(140, 48, "firmware_version", TextAlign::Left);
Label w77(21, 48, "Veersion FW:", TextAlign::Left);
Label w78(21, 80, "Build:", TextAlign::Left);
Label w79(21, 112, "Modèle:", TextAlign::Left);
Label w80(21, 143, "MAC: ", TextAlign::Left);
Label w81(140, 80, "build_number", TextAlign::Left);
Label w82(140, 112, "model_name", TextAlign::Left);
Label w83(140, 144, "mac_adress", TextAlign::Left);
Menu w84(40, 189, 199, 35);
Menu w85(40, 141, 199, 61);
Label w86(0, 37, "Souhaitez vous vraiment", TextAlign::Left);
Label w87(0, 60, "Réinitialiser la Boîte à coeur ?", TextAlign::Left);
Label w88(0, 90, "Le prochain démarrage", TextAlign::Left);
Label w89(0, 106, "Affichera le setup", TextAlign::Left);
Icon w90(104, 88, "emoji:1f42c@w:w_mr176o9r3k", 2);
Label w91(0, 27, "Réinitialisation en cours..", TextAlign::Left);
Label w92(0, 206, "Ne pas débrancher", TextAlign::Left);

// ---- Screens ----
Screen screen_scr_mqwqhtj72("lost_connection");
Screen screen_scr_mqxozray1("splash_screen");
Screen screen_scr_mqxp1a2f2("first_p1");
Screen screen_scr_mqxp1ppa3("new_message");
Screen screen_scr_mqzwbobu5("first_p2");
Screen screen_scr_mqzwqllfl("first_p3");
Screen screen_scr_mqzx2k8qz("first_p4");
Screen screen_scr_mqzxihlp18("first_wifi_error");
Screen screen_scr_mqzxocmh1e("first_p3_wifi_connecting");
Screen screen_scr_mqzyaiw41j("idle");
Screen screen_scr_mr14c6nfb("settings_menu");
Screen screen_scr_mr14qsc4g("settings");
Screen screen_scr_mr15ivvsd("settings_wifi");
Screen screen_scr_mr15nlgnn("settings_date_hours");
Screen screen_scr_mr15t4tyy("settings_disconnect");
Screen screen_scr_mr15w6br17("settings_disconnecting");
Screen screen_scr_mr163td21f("settings_disconnected");
Screen screen_scr_mr169o9w1o("settings_wifi_test");
Screen screen_scr_mr16b8yk1t("settings_wifi_success");
Screen screen_scr_mr16dm621x("settings_wifi_error");
Screen screen_scr_mr16kq912c("settings_informations");
Screen screen_scr_mr171rmq2y("settings_factory_reset");
Screen screen_scr_mr1760ww3i("settings_fatory_reseting");

inline Theme makeTheme() {
    Theme t;
    t.background = color565(18, 3, 16);
    t.surface = color565(255, 255, 255);
    t.surfaceEdge = color565(50, 64, 90);
    t.text = color565(230, 240, 255);
    t.textDim = color565(140, 160, 190);
    t.primary = color565(94, 150, 255);
    t.success = color565(94, 232, 140);
    t.warning = color565(246, 183, 55);
    t.danger = color565(246, 86, 86);
    t.radius = 8;
    t.padding = 8;
    t.rowHeight = 30;
    t.textSize = 1;
    t.font = &LucarneFontBody;
    t.fontTitle = &LucarneFontTitle;
    return t;
}

ButtonInput input;


inline void build(UI &ui) {
    ui.setTheme(makeTheme());
    ui.setTransition(Transition::SlideLeft, 220);
    lucarne::setIconLookups(projet::iconRowsByRef, projet::iconImageByRef, projet::iconAnimByRef);
    // Menu callbacks are polled in loop() — see pollMenuAction() below

    w0.setBounds(1, 12, 279, 29);
    w0.setFont(&LucarneFontTitle);
    w0.setAlign(TextAlign::Center);
    w1.setBounds(0, 40, 280, 28);
    w1.setFont(&LucarneFontBody);
    w1.setAlign(TextAlign::Center);
    w2.setBounds(106, 66, 64, 64);
    w3.setBounds(0, 128, 280, 26);
    w3.setFont(&Font_style_Fira_Sans_14_w400);
    w3.setSize(1);
    w3.setAlign(TextAlign::Center);
    w4.setBounds(0, 148, 280, 17);
    w4.setFont(&LucarneFontBody);
    w4.setAlign(TextAlign::Center);
    w5.setBounds(0, 163, 280, 21);
    w5.setFont(&LucarneFontBody);
    w5.setAlign(TextAlign::Center);
    w6.setBounds(0, 189, 280, 25);
    w6.setFont(&Font_style_Fira_Sans_11_w400);
    w6.setAlign(TextAlign::Center);
    w7.setBounds(0, 209, 280, 17);
    w7.setFont(&Font_style_Fira_Sans_11_w400);
    w7.setAlign(TextAlign::Center);
    w8.setBounds(0, 51, 280, 32);
    w8.setFont(&Font_style_Up_DoItwithLove_mqzw28kc_48_w400);
    w8.setColor(color565(245, 112, 112));
    w8.setSize(3);
    w8.setAlign(TextAlign::Center);
    w9.setBounds(0, 208, 280, 24);
    w9.setFont(&LucarneFontBody);
    w9.setColor(color565(245, 168, 168));
    w9.setAlign(TextAlign::Center);
    w10.setBounds(0, 100, 280, 18);
    w10.setFont(&Font_style_Up_DoItwithLove_mqzw28kc_48_w400);
    w10.setColor(color565(245, 112, 112));
    w10.setAlign(TextAlign::Center);
    w11.setBounds(0, 133, 280, 27);
    w11.setFont(&Font_style_Up_DoItwithLove_mqzw28kc_48_w400);
    w11.setColor(color565(245, 112, 112));
    w11.setAlign(TextAlign::Center);
    w12.setBounds(0, 79, 280, 26);
    w12.setFont(&Font_style_Up_DoItwithLove_mqzw28kc_29_w400);
    w12.setColor(color565(245, 112, 112));
    w12.setAlign(TextAlign::Center);
    w13.setBounds(0, 105, 280, 25);
    w13.setFont(&Font_style_Up_DoItwithLove_mqzw28kc_29_w400);
    w13.setColor(color565(245, 112, 112));
    w13.setAlign(TextAlign::Center);
    w14.setBounds(100, 144, 77, 77);
    w15.setBounds(0, 30, 278, 25);
    w15.setFont(&LucarneFontBody);
    w15.setColor(color565(128, 128, 128));
    w15.setAlign(TextAlign::Center);
    w16.setBounds(120, 0, 32, 32);
    w18.setBounds(0, 69, 280, 32);
    w18.setFont(&Font_style_Up_DoItwithLove_mqzw28kc_39_w400);
    w18.setColor(color565(224, 144, 144));
    w18.setAlign(TextAlign::Center);
    w19.setBounds(76, 109, 128, 128);
    w20.setBounds(0, 22, 280, 35);
    w20.setFont(&LucarneFontBody);
    w20.setColor(color565(181, 115, 115));
    w20.setSpacing(2);
    w20.setAlign(TextAlign::Center);
    w21.setBounds(126, 4, 29, 29);
    w22.setBounds(0, 50, 280, 33);
    w22.setFont(&LucarneFontBody);
    w22.setAlign(TextAlign::Center);
    w23.setBounds(0, 74, 280, 22);
    w23.setFont(&LucarneFontBody);
    w23.setAlign(TextAlign::Center);
    w25.setBounds(0, 30, 278, 25);
    w25.setFont(&LucarneFontBody);
    w25.setColor(color565(128, 128, 128));
    w25.setAlign(TextAlign::Center);
    w26.setBounds(121, 2, 32, 32);
    w27.setBounds(0, 115, 280, 30);
    w27.setFont(&LucarneFontBody);
    w27.setAlign(TextAlign::Center);
    w28.setBounds(0, 100, 280, 29);
    w28.setFont(&LucarneFontBody);
    w28.setAlign(TextAlign::Center);
    w29.setBounds(0, 152, 280, 25);
    w29.setFont(&LucarneFontTitle);
    w29.setAlign(TextAlign::Center);
    w31.setBounds(0, 195, 280, 22);
    w31.setFont(&LucarneFontBody);
    w31.setAlign(TextAlign::Center);
    w32.setBounds(0, 15, 280, 55);
    w32.setFont(&Font_style_Up_DoItwithLove_mqzw28kc_48_w400);
    w32.setAlign(TextAlign::Center);
    w33.setBounds(104, 80, 80, 80);
    w34.setBounds(0, 165, 280, 26);
    w34.setFont(&LucarneFontBody);
    w34.setAlign(TextAlign::Center);
    w35.setBounds(0, 190, 280, 24);
    w35.setFont(&LucarneFontBody);
    w35.setAlign(TextAlign::Center);
    w36.setBounds(0, 23, 280, 28);
    w36.setFont(&LucarneFontBody);
    w36.setAlign(TextAlign::Center);
    w37.setBounds(0, 61, 280, 22);
    w37.setFont(&Font_style_Fira_Sans_16_w400);
    w37.setSize(1);
    w37.setAlign(TextAlign::Center);
    w38.setBounds(0, 190, 280, 28);
    w38.setFont(&LucarneFontBody);
    w38.setAlign(TextAlign::Center);
    w39.setBounds(107, 90, 64, 64);
    w40.setBounds(0, 39, 280, 31);
    w40.setFont(&LucarneFontBody);
    w40.setAlign(TextAlign::Center);
    w41.setBounds(0, 67, 280, 23);
    w41.setFont(&LucarneFontBody);
    w41.setAlign(TextAlign::Center);
    w42.setBounds(0, 91, 280, 24);
    w42.setFont(&LucarneFontBody);
    w42.setAlign(TextAlign::Center);
    w43.setBounds(103, 122, 77, 77);
    w44.setBounds(0, 93, 280, 49);
    w44.setFont(&Font_style_Up_DoItwithLove_mqzw28kc_48_w400);
    w44.setColor(color565(244, 112, 112));
    w44.setSize(1);
    w44.setSpacing(8);
    w44.setAlign(TextAlign::Center);
    w45.setBounds(0, 201, 280, 28);
    w45.setFont(&LucarneFontBody);
    w45.setColor(color565(80, 83, 88));
    w45.setAlign(TextAlign::Center);
    w46.setBounds(0, 34, 280, 26);
    w46.setFont(&Font_style_Up_DoItwithLove_mqzw28kc_24_w400);
    w46.setColor(color565(113, 116, 122));
    w46.setAlign(TextAlign::Center);
    w47.setBounds(126, 2, 32, 32);
    w48.setBounds(0, 147, 280, 20);
    w48.setFont(&Font_style_Up_DoItwithLove_mqzw28kc_28_w400);
    w48.setColor(color565(122, 82, 92));
    w48.setSpacing(0);
    w48.setAlign(TextAlign::Center);
    w49.setActiveFill(color565(255, 255, 255));
    w49.setActiveText(color565(0, 0, 0));
    w49.setInactiveFill(color565(52, 67, 96));
    w49.setInactiveText(color565(0, 0, 0));
    w49.setTextColor(color565(255, 255, 255));
    w49.addItem("Paramètres", "glyphs:cog", &screen_scr_mr14qsc4g, Transition::Inherit, MenuItemOpts{nullptr, true, 24, 1});
    {
        TextStyle st;
        st.color = color565(0, 0, 0);
        st.hasColor = true;
        w49.setItemStyle(0, st);
    }
    w49.addItem("Réinitialiser", "glyphs:arrows-round", &screen_scr_mr171rmq2y, Transition::Inherit, MenuItemOpts{nullptr, true, 24, 0});
    {
        TextStyle st;
        st.color = color565(0, 0, 0);
        st.hasColor = true;
        w49.setItemStyle(1, st);
    }
    w49.addItem("Informations", "glyphs:comment-info", &screen_scr_mr16kq912c, Transition::Inherit, MenuItemOpts{nullptr, true, 24, 0});
    {
        TextStyle st;
        st.font = &LucarneFontBody;
        st.hasFont = true;
        st.color = color565(0, 0, 0);
        st.hasColor = true;
        w49.setItemStyle(2, st);
    }
    w49.addItem("Quitter", nullptr, &screen_scr_mqzyaiw41j, Transition::Inherit, MenuItemOpts{nullptr, true, 0, 0});
    {
        TextStyle st;
        st.color = color565(0, 0, 0);
        st.hasColor = true;
        w49.setItemStyle(3, st);
    }
    w50.setActiveFill(color565(235, 235, 235));
    w50.setActiveText(color565(0, 0, 0));
    w50.setInactiveFill(color565(52, 67, 96));
    w50.setInactiveText(color565(0, 0, 0));
    w50.setTextColor(color565(255, 255, 255));
    w50.addItem("WIFI", "glyphs:wifi-100", &screen_scr_mr15ivvsd, Transition::Inherit, MenuItemOpts{nullptr, true, 24, 1});
    {
        TextStyle st;
        st.color = color565(0, 0, 0);
        st.hasColor = true;
        w50.setItemStyle(0, st);
    }
    w50.addItem("Date/Heure", "glyphs:watch", &screen_scr_mr15nlgnn, Transition::Inherit, MenuItemOpts{nullptr, true, 24, 0});
    {
        TextStyle st;
        st.color = color565(0, 0, 0);
        st.hasColor = true;
        w50.setItemStyle(1, st);
    }
    w50.addItem("Retour", nullptr, &screen_scr_mr14c6nfb, Transition::Inherit, MenuItemOpts{nullptr, true, 24, 0});
    {
        TextStyle st;
        st.font = &LucarneFontBody;
        st.hasFont = true;
        st.color = color565(0, 0, 0);
        st.hasColor = true;
        w50.setItemStyle(2, st);
    }
    w51.setActiveFill(color565(235, 235, 235));
    w51.setActiveText(color565(0, 0, 0));
    w51.setInactiveFill(color565(52, 67, 96));
    w51.setInactiveText(color565(0, 0, 0));
    w51.setTextColor(color565(255, 255, 255));
    w51.addItem("Déconnecter", "glyphs:unlink", &screen_scr_mr15t4tyy, Transition::Inherit, MenuItemOpts{nullptr, true, 24, 1});
    {
        TextStyle st;
        st.color = color565(0, 0, 0);
        st.hasColor = true;
        w51.setItemStyle(0, st);
    }
    w51.addItem("Tester", "glyphs:sparkles", &screen_scr_mr169o9w1o, Transition::Inherit, MenuItemOpts{nullptr, true, 24, 0});
    w51.addItem("Retour", nullptr, &screen_scr_mr14qsc4g, Transition::Inherit, MenuItemOpts{nullptr, true, 24, 0});
    {
        TextStyle st;
        st.font = &LucarneFontBody;
        st.hasFont = true;
        st.color = color565(0, 0, 0);
        st.hasColor = true;
        w51.setItemStyle(2, st);
    }
    w52.setBounds(0, 37, 280, 25);
    w52.setFont(&LucarneFontBody);
    w52.setAlign(TextAlign::Center);
    w53.setBounds(0, 0, 280, 88);
    w53.setFont(&LucarneFontBody);
    w53.setAlign(TextAlign::Center);
    w54.setBounds(0, 55, 280, 22);
    w54.setFont(&LucarneFontBody);
    w54.setAlign(TextAlign::Center);
    w55.setActiveFill(color565(235, 235, 235));
    w55.setActiveText(color565(0, 0, 0));
    w55.setInactiveFill(color565(52, 67, 96));
    w55.setInactiveText(color565(0, 0, 0));
    w55.setTextColor(color565(0, 0, 0));
    w55.addItem("Retour", nullptr, &screen_scr_mr14qsc4g, Transition::Inherit, MenuItemOpts{nullptr, true, 24, 0});
    {
        TextStyle st;
        st.font = &LucarneFontBody;
        st.hasFont = true;
        st.color = color565(0, 0, 0);
        st.hasColor = true;
        w55.setItemStyle(0, st);
    }
    w56.setActiveFill(color565(235, 235, 235));
    w56.setActiveText(color565(0, 0, 0));
    w56.setInactiveFill(color565(52, 67, 96));
    w56.setInactiveText(color565(0, 0, 0));
    w56.setTextColor(color565(255, 255, 255));
    w56.addCallbackItem("Confirmer", "glyphs:check-double@w:w_mr15tyzu13_it_mr15tyzu14", 1, MenuItemOpts{nullptr, true, 24, 1});
    {
        TextStyle st;
        st.color = color565(0, 0, 0);
        st.hasColor = true;
        w56.setItemStyle(0, st);
    }
    w56.addItem("Retour", nullptr, &screen_scr_mr15ivvsd, Transition::Inherit, MenuItemOpts{nullptr, true, 24, 0});
    {
        TextStyle st;
        st.font = &LucarneFontBody;
        st.hasFont = true;
        st.color = color565(0, 0, 0);
        st.hasColor = true;
        w56.setItemStyle(1, st);
    }
    w57.setBounds(0, 29, 280, 35);
    w57.setFont(&LucarneFontBody);
    w57.setAlign(TextAlign::Center);
    w58.setBounds(0, 52, 280, 24);
    w58.setFont(&LucarneFontBody);
    w58.setAlign(TextAlign::Center);
    w59.setBounds(0, 73, 280, 21);
    w59.setFont(&LucarneFontBody);
    w59.setAlign(TextAlign::Center);
    w60.setBounds(0, 27, 280, 42);
    w60.setFont(&LucarneFontBody);
    w60.setAlign(TextAlign::Center);
    w61.setBounds(104, 88, 72, 72);
    w62.setBounds(0, 47, 280, 28);
    w62.setFont(&LucarneFontBody);
    w62.setAlign(TextAlign::Center);
    w63.setBounds(0, 106, 280, 21);
    w63.setFont(&LucarneFontBody);
    w63.setAlign(TextAlign::Center);
    w64.setBounds(0, 124, 280, 22);
    w64.setFont(&LucarneFontBody);
    w64.setAlign(TextAlign::Center);
    w65.setBounds(0, 142, 280, 23);
    w65.setFont(&LucarneFontBody);
    w65.setAlign(TextAlign::Center);
    w66.setActiveFill(color565(235, 235, 235));
    w66.setActiveText(color565(0, 0, 0));
    w66.setInactiveFill(color565(52, 67, 96));
    w66.setInactiveText(color565(0, 0, 0));
    w66.setTextColor(color565(255, 255, 255));
    w66.addItem("Retour", nullptr, &screen_scr_mqwqhtj72, Transition::Inherit, MenuItemOpts{nullptr, true, 24, 0});
    {
        TextStyle st;
        st.font = &LucarneFontBody;
        st.hasFont = true;
        st.color = color565(0, 0, 0);
        st.hasColor = true;
        w66.setItemStyle(0, st);
    }
    w67.setBounds(0, 25, 280, 42);
    w67.setFont(&LucarneFontBody);
    w67.setAlign(TextAlign::Center);
    w68.setBounds(104, 88, 72, 72);
    w69.setBounds(96, 74, 90, 90);
    w70.setBounds(0, 34, 280, 34);
    w70.setFont(&LucarneFontBody);
    w70.setAlign(TextAlign::Center);
    w71.setActiveFill(color565(235, 235, 235));
    w71.setActiveText(color565(0, 0, 0));
    w71.setInactiveFill(color565(52, 67, 96));
    w71.setInactiveText(color565(0, 0, 0));
    w71.setTextColor(color565(255, 255, 255));
    w71.addItem("Retour", nullptr, &screen_scr_mr15ivvsd, Transition::Inherit, MenuItemOpts{nullptr, true, 24, 0});
    {
        TextStyle st;
        st.font = &LucarneFontBody;
        st.hasFont = true;
        st.color = color565(0, 0, 0);
        st.hasColor = true;
        w71.setItemStyle(0, st);
    }
    w72.setBounds(108, 88, 64, 64);
    w73.setBounds(0, 34, 280, 26);
    w73.setFont(&LucarneFontBody);
    w73.setAlign(TextAlign::Center);
    w74.setBounds(0, 55, 280, 22);
    w74.setFont(&LucarneFontBody);
    w74.setAlign(TextAlign::Center);
    w75.setActiveFill(color565(235, 235, 235));
    w75.setActiveText(color565(0, 0, 0));
    w75.setInactiveFill(color565(52, 67, 96));
    w75.setInactiveText(color565(0, 0, 0));
    w75.setTextColor(color565(255, 255, 255));
    w75.addItem("Retour", nullptr, &screen_scr_mr15ivvsd, Transition::Inherit, MenuItemOpts{nullptr, true, 24, 0});
    {
        TextStyle st;
        st.font = &LucarneFontBody;
        st.hasFont = true;
        st.color = color565(0, 0, 0);
        st.hasColor = true;
        w75.setItemStyle(0, st);
    }
    w76.setBounds(140, 48, 113, 32);
    w76.setFont(&LucarneFontBody);
    w76.setAlign(TextAlign::Left);
    w77.setBounds(21, 48, 96, 32);
    w77.setFont(&LucarneFontBody);
    w77.setAlign(TextAlign::Left);
    w78.setBounds(21, 80, 96, 32);
    w78.setFont(&LucarneFontBody);
    w78.setAlign(TextAlign::Left);
    w79.setBounds(21, 112, 96, 32);
    w79.setFont(&LucarneFontBody);
    w79.setAlign(TextAlign::Left);
    w80.setBounds(21, 143, 96, 32);
    w80.setFont(&LucarneFontBody);
    w80.setAlign(TextAlign::Left);
    w81.setBounds(140, 80, 113, 32);
    w81.setFont(&LucarneFontBody);
    w81.setAlign(TextAlign::Left);
    w82.setBounds(140, 112, 113, 32);
    w82.setFont(&LucarneFontBody);
    w82.setAlign(TextAlign::Left);
    w83.setBounds(140, 144, 113, 32);
    w83.setFont(&LucarneFontBody);
    w83.setAlign(TextAlign::Left);
    w84.setActiveFill(color565(235, 235, 235));
    w84.setActiveText(color565(0, 0, 0));
    w84.setInactiveFill(color565(52, 67, 96));
    w84.setInactiveText(color565(0, 0, 0));
    w84.setTextColor(color565(255, 255, 255));
    w84.addItem("Retour", nullptr, &screen_scr_mr14c6nfb, Transition::Inherit, MenuItemOpts{nullptr, true, 24, 0});
    {
        TextStyle st;
        st.font = &LucarneFontBody;
        st.hasFont = true;
        st.color = color565(0, 0, 0);
        st.hasColor = true;
        w84.setItemStyle(0, st);
    }
    w85.setActiveFill(color565(235, 235, 235));
    w85.setActiveText(color565(0, 0, 0));
    w85.setInactiveFill(color565(52, 67, 96));
    w85.setInactiveText(color565(0, 0, 0));
    w85.setTextColor(color565(255, 255, 255));
    w85.addItem("Confirmer", "glyphs:check-double@w:w_mr172rxd32_it_mr172rxd33", &screen_scr_mr1760ww3i, Transition::Inherit, MenuItemOpts{nullptr, true, 24, 1});
    {
        TextStyle st;
        st.color = color565(0, 0, 0);
        st.hasColor = true;
        w85.setItemStyle(0, st);
    }
    w85.addItem("Retour", nullptr, &screen_scr_mr14c6nfb, Transition::Inherit, MenuItemOpts{nullptr, true, 24, 0});
    {
        TextStyle st;
        st.font = &LucarneFontBody;
        st.hasFont = true;
        st.color = color565(0, 0, 0);
        st.hasColor = true;
        w85.setItemStyle(1, st);
    }
    w86.setBounds(0, 37, 280, 35);
    w86.setFont(&LucarneFontBody);
    w86.setAlign(TextAlign::Center);
    w87.setBounds(0, 60, 280, 24);
    w87.setFont(&LucarneFontBody);
    w87.setAlign(TextAlign::Center);
    w88.setBounds(0, 90, 280, 21);
    w88.setFont(&LucarneFontBody);
    w88.setAlign(TextAlign::Center);
    w89.setBounds(0, 106, 280, 25);
    w89.setFont(&LucarneFontBody);
    w89.setAlign(TextAlign::Center);
    w90.setBounds(104, 88, 72, 72);
    w91.setBounds(0, 27, 280, 42);
    w91.setFont(&LucarneFontBody);
    w91.setAlign(TextAlign::Center);
    w92.setBounds(0, 206, 280, 27);
    w92.setFont(&LucarneFontBody);
    w92.setAlign(TextAlign::Center);

    screen_scr_mqwqhtj72.add(&w0);
    screen_scr_mqwqhtj72.add(&w1);
    screen_scr_mqwqhtj72.add(&w2);
    screen_scr_mqwqhtj72.add(&w3);
    screen_scr_mqwqhtj72.add(&w4);
    screen_scr_mqwqhtj72.add(&w5);
    screen_scr_mqwqhtj72.add(&w6);
    screen_scr_mqwqhtj72.add(&w7);
    screen_scr_mqxozray1.add(&w8);
    screen_scr_mqxozray1.add(&w9);
    screen_scr_mqxozray1.add(&w10);
    screen_scr_mqxozray1.add(&w11);
    screen_scr_mqxp1a2f2.add(&w12);
    screen_scr_mqxp1a2f2.add(&w13);
    screen_scr_mqxp1a2f2.add(&w14);
    screen_scr_mqxp1a2f2.add(&w15);
    screen_scr_mqxp1a2f2.add(&w16);
    screen_scr_mqxp1ppa3.add(&w17);
    screen_scr_mqxp1ppa3.add(&w18);
    screen_scr_mqxp1ppa3.add(&w19);
    screen_scr_mqxp1ppa3.add(&w20);
    screen_scr_mqxp1ppa3.add(&w21);
    screen_scr_mqzwbobu5.add(&w22);
    screen_scr_mqzwbobu5.add(&w23);
    screen_scr_mqzwbobu5.add(&w24);
    screen_scr_mqzwbobu5.add(&w25);
    screen_scr_mqzwbobu5.add(&w26);
    screen_scr_mqzwqllfl.add(&w27);
    screen_scr_mqzwqllfl.add(&w28);
    screen_scr_mqzwqllfl.add(&w29);
    screen_scr_mqzwqllfl.add(&w30);
    screen_scr_mqzwqllfl.add(&w31);
    screen_scr_mqzx2k8qz.add(&w32);
    screen_scr_mqzx2k8qz.add(&w33);
    screen_scr_mqzx2k8qz.add(&w34);
    screen_scr_mqzx2k8qz.add(&w35);
    screen_scr_mqzxihlp18.add(&w36);
    screen_scr_mqzxihlp18.add(&w37);
    screen_scr_mqzxihlp18.add(&w38);
    screen_scr_mqzxihlp18.add(&w39);
    screen_scr_mqzxocmh1e.add(&w40);
    screen_scr_mqzxocmh1e.add(&w41);
    screen_scr_mqzxocmh1e.add(&w42);
    screen_scr_mqzxocmh1e.add(&w43);
    screen_scr_mqzyaiw41j.add(&w44);
    screen_scr_mqzyaiw41j.add(&w45);
    screen_scr_mqzyaiw41j.add(&w46);
    screen_scr_mqzyaiw41j.add(&w47);
    screen_scr_mqzyaiw41j.add(&w48);
    screen_scr_mr14c6nfb.add(&w49);
    screen_scr_mr14qsc4g.add(&w50);
    screen_scr_mr15ivvsd.add(&w51);
    screen_scr_mr15ivvsd.add(&w52);
    screen_scr_mr15nlgnn.add(&w53);
    screen_scr_mr15nlgnn.add(&w54);
    screen_scr_mr15nlgnn.add(&w55);
    screen_scr_mr15t4tyy.add(&w56);
    screen_scr_mr15t4tyy.add(&w57);
    screen_scr_mr15t4tyy.add(&w58);
    screen_scr_mr15t4tyy.add(&w59);
    screen_scr_mr15w6br17.add(&w60);
    screen_scr_mr15w6br17.add(&w61);
    screen_scr_mr163td21f.add(&w62);
    screen_scr_mr163td21f.add(&w63);
    screen_scr_mr163td21f.add(&w64);
    screen_scr_mr163td21f.add(&w65);
    screen_scr_mr163td21f.add(&w66);
    screen_scr_mr169o9w1o.add(&w67);
    screen_scr_mr169o9w1o.add(&w68);
    screen_scr_mr16b8yk1t.add(&w69);
    screen_scr_mr16b8yk1t.add(&w70);
    screen_scr_mr16b8yk1t.add(&w71);
    screen_scr_mr16dm621x.add(&w72);
    screen_scr_mr16dm621x.add(&w73);
    screen_scr_mr16dm621x.add(&w74);
    screen_scr_mr16dm621x.add(&w75);
    screen_scr_mr16kq912c.add(&w76);
    screen_scr_mr16kq912c.add(&w77);
    screen_scr_mr16kq912c.add(&w78);
    screen_scr_mr16kq912c.add(&w79);
    screen_scr_mr16kq912c.add(&w80);
    screen_scr_mr16kq912c.add(&w81);
    screen_scr_mr16kq912c.add(&w82);
    screen_scr_mr16kq912c.add(&w83);
    screen_scr_mr16kq912c.add(&w84);
    screen_scr_mr171rmq2y.add(&w85);
    screen_scr_mr171rmq2y.add(&w86);
    screen_scr_mr171rmq2y.add(&w87);
    screen_scr_mr171rmq2y.add(&w88);
    screen_scr_mr171rmq2y.add(&w89);
    screen_scr_mr1760ww3i.add(&w90);
    screen_scr_mr1760ww3i.add(&w91);
    screen_scr_mr1760ww3i.add(&w92);

    ui.setString("bd_name_device", "lb_v01dev");

    ui.show(&screen_scr_mqxozray1);
}

inline void attachInput(UI &ui) {
    input.begin(-1, -1, -1, -1, true);
    input.attach(&ui);
}

inline void update() {
    input.update();
}

// In loop(), after projet::update() and ui.update():
//   switch (ui.pollMenuAction()) {
//     case ACTION_SETTINGS_DISCONNECT_CONFIRM: /* your code */ break;
//   }

}  // namespace projet

// Usage in your sketch:
//   #include "Projet_setup.h"
//   Display display; UI ui(display);
//   initSpiBus();
//   projet::initStorage();  // before display.begin()
//   display.begin(projet::displayPins(), projet::displayOptions(), buffer, &SPI);
//   projet::build(ui);
//   projet::attachInput(ui);
//   ui.begin();
//   void loop() { projet::update(); ui.update(); }

#endif