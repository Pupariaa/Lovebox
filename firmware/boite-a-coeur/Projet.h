#ifndef PROJET_H
#define PROJET_H

#include <Lucarne.h>
#include "Projet_fonts.h"
#include "Projet_images.h"
#include "Projet_icons.h"
#include "Projet_setup.h"
#include "BacLocale.h"

using namespace lucarne;

// Menu actions — read in loop() with ui.pollMenuAction() (constants below)
static const uint8_t ACTION_SETTINGS_DISCONNECT_CONFIRM = 1;

inline uint8_t pollMenuAction(UI &ui) { return ui.pollMenuAction(); }

namespace projet {

// ---- Widgets ----
Label w0(1, 12, "Connexion perdue", TextAlign::Left);
Label w1(0, 40, "La connexion à internet a échouée", TextAlign::Left);
Label w2(0, 92, "il semblerais que votre boîte à coeur", TextAlign::Left);
Label w3(0, 113, "ne parvienne pas à se ", TextAlign::Left);
Label w4(0, 127, "connecter à internet", TextAlign::Left);
Label w5(0, 177, "Vérifiez la configuration", TextAlign::Left);
Label w6(0, 196, "depuis l'application Boite à Coeur", TextAlign::Left);
Label w7(0, 51, "Boite", TextAlign::Left);
Label w8(0, 208, "Démarrage...", TextAlign::Left);
Label w9(0, 100, "à", TextAlign::Left);
Label w10(0, 133, "Coeur", TextAlign::Left);
Label w11(0, 79, "Bienvenue dans", TextAlign::Left);
Label w12(0, 105, "votre boite à coeur !", TextAlign::Left);
Icon w13(100, 144, "emoji:1f44b-1f3fb", 24);
Icon w14(124, 0, "glyphs:arrow-solid-bracket-start@w:w_mr2y83n1f", 1);
Label w15(2, 29, "Suivant", TextAlign::Left);
Image w16(0, 0, 280, 240, &Img_img_mqxqcdzu6);
Label w17(0, 69, "Nouveau message", TextAlign::Left);
Icon w18(76, 109, "emoji:1f48c", 4);
Label w19(0, 24, "Ouvrir", TextAlign::Left);
Icon w20(124, 0, "glyphs:arrow-solid-bracket-start@w:w_mr2y5dupb", 1);
Label w21(0, 50, "Téléchargez l'application", TextAlign::Left);
Label w22(0, 74, "pour configurer votre boîte à coeur", TextAlign::Left);
Image w23(88, 104, 104, 104, &Img_img_mqzwhl42d);
Label w24(0, 30, "Suivant", TextAlign::Left);
Icon w25(124, 0, "glyphs:arrow-solid-bracket-start@w:w_mr2y8ozbc", 1);
Label w26(0, 115, "et connectez vous à ", TextAlign::Left);
Label w27(0, 100, "Une fois installée, activez le Bluetooth", TextAlign::Left);
Label w28(0, 152, "device_bt_name", TextAlign::Left);
Image w29(120, 24, 40, 56, &Img_img_mqzx0357u);
Label w30(0, 195, "Et poursuivez sur votre smartphone", TextAlign::Left);
Label w31(0, 15, "Bravo !", TextAlign::Left);
Icon w32(104, 80, "emoji:1f389@w:w_mqzx3u1111", 24);
Label w33(0, 165, "Votre boîte à coeur est ", TextAlign::Left);
Label w34(0, 190, "désormais configurée", TextAlign::Left);
Label w35(0, 23, "Impossible de se connecter à", TextAlign::Left);
Label w36(0, 61, "SSID_name", TextAlign::Left);
Label w37(0, 190, "Vérifiez vos paramètres", TextAlign::Left);
Icon w38(107, 90, "emoji:1f614@w:w_mqzxkguj1c", 2);
Label w39(0, 25, "Connexion au réseau wifi", TextAlign::Left);
Label w40(0, 53, "SSID_name", TextAlign::Left);
Label w41(0, 74, "en cours..", TextAlign::Left);
Icon w42(108, 113, "glyphs:spinner-2@w:w_mrbesk3hb", 1);
Label w43(0, 93, "23:59", TextAlign::Left);
Label w44(0, 201, "Pas de nouveau message", TextAlign::Left);
Label w45(0, 34, "Envoyer un coeur", TextAlign::Left);
Label w46(0, 147, "JJ jj aaaa", TextAlign::Left);
Icon w47(124, 0, "glyphs:arrow-solid-bracket-start@w:w_mr2y7ru6d", 1);
Menu w48(40, 48, 199, 157);
Menu w49(40, 48, 199, 157);
Menu w50(40, 83, 199, 157);
Label w51(0, 37, "SSID_name", TextAlign::Left);
Menu w52(40, 16, 200, 217);
Menu w53(40, 141, 199, 61);
Label w54(0, 29, "Souhaitez vous vraiment", TextAlign::Left);
Label w55(0, 52, "déconnecter votre", TextAlign::Left);
Label w56(0, 73, "Boîte à coeur d'internet ?", TextAlign::Left);
Label w57(0, 60, "Déconnexion en cours...", TextAlign::Left);
Icon w58(109, 113, "glyphs:spinner-2@w:w_mrbeuqokd", 1);
Label w59(0, 47, "La Boîte à coeur a été déconnectée", TextAlign::Left);
Label w60(0, 106, "Pour utiliser la Boîte à coeur, ", TextAlign::Left);
Label w61(0, 124, "Vous devez spécifier une", TextAlign::Left);
Label w62(0, 142, "connexion internet.", TextAlign::Left);
Menu w63(40, 189, 199, 35);
Label w64(0, 63, "Test de la connexion en cours...", TextAlign::Left);
Icon w65(108, 114, "glyphs:spinner-2@w:w_mrbev68te", 1);
Icon w66(96, 74, "emoji:1f389@w:w_mr16c6451w", 28);
Label w67(0, 34, "Connexion parfaite !", TextAlign::Left);
Menu w68(40, 189, 199, 35);
Icon w69(108, 88, "emoji:1f614@w:w_mr16e7f01z", 2);
Label w70(0, 34, "Aie... Impossible de joindre", TextAlign::Left);
Label w71(0, 55, "les serveurs.. Réessayez plus tard", TextAlign::Left);
Menu w72(40, 189, 199, 35);
Label w73(140, 48, "firmware_version", TextAlign::Left);
Label w74(21, 48, "Veersion FW:", TextAlign::Left);
Label w75(21, 80, "Build:", TextAlign::Left);
Label w76(21, 112, "Modèle:", TextAlign::Left);
Label w77(21, 143, "MAC: ", TextAlign::Left);
Label w78(140, 80, "build_number", TextAlign::Left);
Label w79(140, 112, "model_name", TextAlign::Left);
Label w80(140, 144, "mac_adress", TextAlign::Left);
Menu w81(40, 189, 199, 35);
Menu w82(40, 141, 199, 61);
Label w83(0, 37, "Souhaitez vous vraiment", TextAlign::Left);
Label w84(0, 60, "Réinitialiser la Boîte à coeur ?", TextAlign::Left);
Label w85(0, 90, "Le prochain démarrage", TextAlign::Left);
Label w86(0, 106, "Affichera le setup", TextAlign::Left);
Label w87(0, 27, "Réinitialisation en cours..", TextAlign::Left);
Label w88(0, 184, "Ne pas débrancher", TextAlign::Left);
Bar w89(56, 104, 165, 35, "ota_pct", 0.0f, 100.0f);
Label w90(0, 70, "Mise à jour en cours..", TextAlign::Left);
Label w91(0, 96, "Ne pas débrancher", TextAlign::Left);
Bar w92(56, 136, 165, 35, "ota_pct", 0.0f, 100.0f);

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
Screen screen_scr_mr1760ww3i("settings_factory_reseting");
Screen screen_scr_mr3hcyofj("updating");

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
    BacLocale::prepare("fr");
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
    w2.setBounds(0, 92, 280, 26);
    w2.setFont(&Font_style_Fira_Sans_14_w400);
    w2.setSize(1);
    w2.setAlign(TextAlign::Center);
    w3.setBounds(0, 113, 280, 17);
    w3.setFont(&LucarneFontBody);
    w3.setAlign(TextAlign::Center);
    w4.setBounds(0, 127, 280, 21);
    w4.setFont(&LucarneFontBody);
    w4.setAlign(TextAlign::Center);
    w5.setBounds(0, 177, 280, 25);
    w5.setFont(&Font_style_Fira_Sans_11_w400);
    w5.setAlign(TextAlign::Center);
    w6.setBounds(0, 196, 280, 17);
    w6.setFont(&Font_style_Fira_Sans_11_w400);
    w6.setAlign(TextAlign::Center);
    w7.setBounds(0, 51, 280, 32);
    w7.setFont(&Font_style_Up_DoItwithLove_mqzw28kc_48_w400);
    w7.setColor(color565(245, 112, 112));
    w7.setSize(3);
    w7.setAlign(TextAlign::Center);
    w8.setBounds(0, 208, 280, 24);
    w8.setFont(&LucarneFontBody);
    w8.setColor(color565(245, 168, 168));
    w8.setAlign(TextAlign::Center);
    w9.setBounds(0, 100, 280, 18);
    w9.setFont(&Font_style_Up_DoItwithLove_mqzw28kc_48_w400);
    w9.setColor(color565(245, 112, 112));
    w9.setAlign(TextAlign::Center);
    w10.setBounds(0, 133, 280, 27);
    w10.setFont(&Font_style_Up_DoItwithLove_mqzw28kc_48_w400);
    w10.setColor(color565(245, 112, 112));
    w10.setAlign(TextAlign::Center);
    w11.setBounds(0, 79, 280, 26);
    w11.setFont(&Font_style_Up_DoItwithLove_mqzw28kc_29_w400);
    w11.setColor(color565(245, 112, 112));
    w11.setAlign(TextAlign::Center);
    w12.setBounds(0, 105, 280, 25);
    w12.setFont(&Font_style_Up_DoItwithLove_mqzw28kc_29_w400);
    w12.setColor(color565(245, 112, 112));
    w12.setAlign(TextAlign::Center);
    w13.setBounds(100, 144, 77, 77);
    w14.setBounds(124, 0, 32, 32);
    w15.setBounds(2, 29, 278, 25);
    w15.setFont(&LucarneFontBody);
    w15.setColor(color565(128, 128, 128));
    w15.setAlign(TextAlign::Center);
    w17.setBounds(0, 69, 280, 32);
    w17.setFont(&Font_style_Up_DoItwithLove_mqzw28kc_39_w400);
    w17.setColor(color565(224, 144, 144));
    w17.setAlign(TextAlign::Center);
    w18.setBounds(76, 109, 128, 128);
    w19.setBounds(0, 24, 280, 35);
    w19.setFont(&LucarneFontBody);
    w19.setColor(color565(181, 115, 115));
    w19.setSpacing(2);
    w19.setAlign(TextAlign::Center);
    w20.setBounds(124, 0, 32, 32);
    w21.setBounds(0, 50, 280, 33);
    w21.setFont(&LucarneFontBody);
    w21.setAlign(TextAlign::Center);
    w22.setBounds(0, 74, 280, 22);
    w22.setFont(&LucarneFontBody);
    w22.setAlign(TextAlign::Center);
    w24.setBounds(0, 30, 278, 25);
    w24.setFont(&LucarneFontBody);
    w24.setColor(color565(128, 128, 128));
    w24.setAlign(TextAlign::Center);
    w25.setBounds(124, 0, 32, 32);
    w26.setBounds(0, 115, 280, 30);
    w26.setFont(&LucarneFontBody);
    w26.setAlign(TextAlign::Center);
    w27.setBounds(0, 100, 280, 29);
    w27.setFont(&LucarneFontBody);
    w27.setAlign(TextAlign::Center);
    w28.setBounds(0, 152, 280, 25);
    w28.setFont(&LucarneFontTitle);
    w28.setAlign(TextAlign::Center);
    w30.setBounds(0, 195, 280, 22);
    w30.setFont(&LucarneFontBody);
    w30.setAlign(TextAlign::Center);
    w31.setBounds(0, 15, 280, 55);
    w31.setFont(&Font_style_Up_DoItwithLove_mqzw28kc_48_w400);
    w31.setAlign(TextAlign::Center);
    w32.setBounds(104, 80, 80, 80);
    w33.setBounds(0, 165, 280, 26);
    w33.setFont(&LucarneFontBody);
    w33.setAlign(TextAlign::Center);
    w34.setBounds(0, 190, 280, 24);
    w34.setFont(&LucarneFontBody);
    w34.setAlign(TextAlign::Center);
    w35.setBounds(0, 23, 280, 28);
    w35.setFont(&LucarneFontBody);
    w35.setAlign(TextAlign::Center);
    w36.setBounds(0, 61, 280, 22);
    w36.setFont(&Font_style_Fira_Sans_16_w400);
    w36.setSize(1);
    w36.setAlign(TextAlign::Center);
    w37.setBounds(0, 190, 280, 28);
    w37.setFont(&LucarneFontBody);
    w37.setAlign(TextAlign::Center);
    w38.setBounds(107, 90, 64, 64);
    w39.setBounds(0, 25, 280, 31);
    w39.setFont(&LucarneFontBody);
    w39.setAlign(TextAlign::Center);
    w40.setBounds(0, 53, 280, 23);
    w40.setFont(&LucarneFontBody);
    w40.setAlign(TextAlign::Center);
    w41.setBounds(0, 74, 280, 24);
    w41.setFont(&LucarneFontBody);
    w41.setAlign(TextAlign::Center);
    w42.setBounds(108, 113, 64, 64);
    w43.setBounds(0, 93, 280, 49);
    w43.setFont(&Font_style_Up_DoItwithLove_mqzw28kc_48_w400);
    w43.setColor(color565(244, 112, 112));
    w43.setSize(1);
    w43.setSpacing(8);
    w43.setAlign(TextAlign::Center);
    w44.setBounds(0, 201, 280, 28);
    w44.setFont(&LucarneFontBody);
    w44.setColor(color565(80, 83, 88));
    w44.setAlign(TextAlign::Center);
    w45.setBounds(0, 34, 280, 26);
    w45.setFont(&Font_style_Up_DoItwithLove_mqzw28kc_24_w400);
    w45.setColor(color565(113, 116, 122));
    w45.setAlign(TextAlign::Center);
    w46.setBounds(0, 147, 280, 20);
    w46.setFont(&Font_style_Up_DoItwithLove_mqzw28kc_28_w400);
    w46.setColor(color565(122, 82, 92));
    w46.setSpacing(0);
    w46.setAlign(TextAlign::Center);
    w47.setBounds(124, 0, 32, 32);
    w48.setActiveFill(color565(255, 255, 255));
    w48.setActiveText(color565(0, 0, 0));
    w48.setInactiveFill(color565(52, 67, 96));
    w48.setInactiveText(color565(0, 0, 0));
    w48.setTextColor(color565(255, 255, 255));
    w48.addItem(BacLocale::lbl_settings, "glyphs:cog", &screen_scr_mr14qsc4g, Transition::Inherit, MenuItemOpts{nullptr, true, 24, 1});
    {
        TextStyle st;
        st.color = color565(0, 0, 0);
        st.hasColor = true;
        w48.setItemStyle(0, st);
    }
    w48.addItem(BacLocale::lbl_reset, "glyphs:arrows-round", &screen_scr_mr171rmq2y, Transition::Inherit, MenuItemOpts{nullptr, true, 24, 0});
    {
        TextStyle st;
        st.color = color565(0, 0, 0);
        st.hasColor = true;
        w48.setItemStyle(1, st);
    }
    w48.addItem(BacLocale::lbl_info, "glyphs:comment-info", &screen_scr_mr16kq912c, Transition::Inherit, MenuItemOpts{nullptr, true, 24, 0});
    {
        TextStyle st;
        st.font = &LucarneFontBody;
        st.hasFont = true;
        st.color = color565(0, 0, 0);
        st.hasColor = true;
        w48.setItemStyle(2, st);
    }
    w48.addItem(BacLocale::lbl_quit, nullptr, &screen_scr_mqzyaiw41j, Transition::Inherit, MenuItemOpts{nullptr, true, 0, 0});
    {
        TextStyle st;
        st.color = color565(0, 0, 0);
        st.hasColor = true;
        w48.setItemStyle(3, st);
    }
    w49.setActiveFill(color565(235, 235, 235));
    w49.setActiveText(color565(0, 0, 0));
    w49.setInactiveFill(color565(52, 67, 96));
    w49.setInactiveText(color565(0, 0, 0));
    w49.setTextColor(color565(255, 255, 255));
    w49.addItem(BacLocale::lbl_wifi, "glyphs:wifi-100", &screen_scr_mr15ivvsd, Transition::Inherit, MenuItemOpts{nullptr, true, 24, 1});
    {
        TextStyle st;
        st.color = color565(0, 0, 0);
        st.hasColor = true;
        w49.setItemStyle(0, st);
    }
    w49.addItem(BacLocale::lbl_language, "glyphs:globe", &screen_scr_mr15nlgnn, Transition::Inherit, MenuItemOpts{nullptr, true, 24, 0});
    {
        TextStyle st;
        st.color = color565(0, 0, 0);
        st.hasColor = true;
        w49.setItemStyle(1, st);
    }
    w49.addItem(BacLocale::lbl_back, nullptr, &screen_scr_mr14c6nfb, Transition::Inherit, MenuItemOpts{nullptr, true, 24, 0});
    {
        TextStyle st;
        st.font = &LucarneFontBody;
        st.hasFont = true;
        st.color = color565(0, 0, 0);
        st.hasColor = true;
        w49.setItemStyle(2, st);
    }
    w50.setActiveFill(color565(235, 235, 235));
    w50.setActiveText(color565(0, 0, 0));
    w50.setInactiveFill(color565(52, 67, 96));
    w50.setInactiveText(color565(0, 0, 0));
    w50.setTextColor(color565(255, 255, 255));
    w50.addItem(BacLocale::lbl_disconnect, nullptr, &screen_scr_mr15t4tyy, Transition::Inherit, MenuItemOpts{nullptr, true, 24, 1});
    {
        TextStyle st;
        st.color = color565(0, 0, 0);
        st.hasColor = true;
        w50.setItemStyle(0, st);
    }
    w50.addItem(BacLocale::lbl_test, nullptr, &screen_scr_mr169o9w1o, Transition::Inherit, MenuItemOpts{nullptr, true, 24, 0});
    w50.addItem(BacLocale::lbl_back, nullptr, &screen_scr_mr14qsc4g, Transition::Inherit, MenuItemOpts{nullptr, true, 24, 0});
    {
        TextStyle st;
        st.font = &LucarneFontBody;
        st.hasFont = true;
        st.color = color565(0, 0, 0);
        st.hasColor = true;
        w50.setItemStyle(2, st);
    }
    w51.setBounds(0, 37, 280, 25);
    w51.setFont(&LucarneFontBody);
    w51.setAlign(TextAlign::Center);
    w52.setActiveFill(color565(235, 235, 235));
    w52.setActiveText(color565(0, 0, 0));
    w52.setInactiveFill(color565(52, 67, 96));
    w52.setInactiveText(color565(0, 0, 0));
    w52.setTextColor(color565(0, 0, 0));
    w52.addItem("Français", nullptr, &screen_scr_mr14qsc4g, Transition::Inherit, MenuItemOpts{nullptr, true, 24, 0});
    {
        TextStyle st;
        st.font = &LucarneFontBody;
        st.hasFont = true;
        st.color = color565(0, 0, 0);
        st.hasColor = true;
        w52.setItemStyle(0, st);
    }
    w52.addItem("English", nullptr, &screen_scr_mr14qsc4g, Transition::Inherit, MenuItemOpts{nullptr, true, 0, 0});
    w52.addItem("Italian", nullptr, &screen_scr_mr14qsc4g, Transition::Inherit, MenuItemOpts{nullptr, true, 0, 0});
    w52.addItem("Deutsch", nullptr, &screen_scr_mr14qsc4g, Transition::Inherit, MenuItemOpts{nullptr, true, 0, 0});
    w52.addItem("Português", nullptr, &screen_scr_mr14qsc4g, Transition::Inherit, MenuItemOpts{nullptr, true, 0, 0});
    w52.addItem("español", nullptr, &screen_scr_mr14qsc4g, Transition::Inherit, MenuItemOpts{nullptr, true, 0, 0});
    w52.addItem(BacLocale::lbl_back, nullptr, &screen_scr_mr14qsc4g, Transition::Inherit, MenuItemOpts{nullptr, true, 0, 0});
    w53.setActiveFill(color565(235, 235, 235));
    w53.setActiveText(color565(0, 0, 0));
    w53.setInactiveFill(color565(52, 67, 96));
    w53.setInactiveText(color565(0, 0, 0));
    w53.setTextColor(color565(255, 255, 255));
    w53.addCallbackItem(BacLocale::lbl_confirm, "glyphs:check-double@w:w_mr15tyzu13_it_mr15tyzu14", 1, MenuItemOpts{nullptr, true, 24, 1});
    {
        TextStyle st;
        st.color = color565(0, 0, 0);
        st.hasColor = true;
        w53.setItemStyle(0, st);
    }
    w53.addItem(BacLocale::lbl_back, nullptr, &screen_scr_mr15ivvsd, Transition::Inherit, MenuItemOpts{nullptr, true, 24, 0});
    {
        TextStyle st;
        st.font = &LucarneFontBody;
        st.hasFont = true;
        st.color = color565(0, 0, 0);
        st.hasColor = true;
        w53.setItemStyle(1, st);
    }
    w54.setBounds(0, 29, 280, 35);
    w54.setFont(&LucarneFontBody);
    w54.setAlign(TextAlign::Center);
    w55.setBounds(0, 52, 280, 24);
    w55.setFont(&LucarneFontBody);
    w55.setAlign(TextAlign::Center);
    w56.setBounds(0, 73, 280, 21);
    w56.setFont(&LucarneFontBody);
    w56.setAlign(TextAlign::Center);
    w57.setBounds(0, 60, 280, 42);
    w57.setFont(&LucarneFontBody);
    w57.setAlign(TextAlign::Center);
    w58.setBounds(109, 113, 64, 64);
    w59.setBounds(0, 47, 280, 28);
    w59.setFont(&LucarneFontBody);
    w59.setAlign(TextAlign::Center);
    w60.setBounds(0, 106, 280, 21);
    w60.setFont(&LucarneFontBody);
    w60.setAlign(TextAlign::Center);
    w61.setBounds(0, 124, 280, 22);
    w61.setFont(&LucarneFontBody);
    w61.setAlign(TextAlign::Center);
    w62.setBounds(0, 142, 280, 23);
    w62.setFont(&LucarneFontBody);
    w62.setAlign(TextAlign::Center);
    w63.setActiveFill(color565(235, 235, 235));
    w63.setActiveText(color565(0, 0, 0));
    w63.setInactiveFill(color565(52, 67, 96));
    w63.setInactiveText(color565(0, 0, 0));
    w63.setTextColor(color565(255, 255, 255));
    w63.addItem(BacLocale::lbl_back, nullptr, &screen_scr_mqwqhtj72, Transition::Inherit, MenuItemOpts{nullptr, true, 24, 0});
    {
        TextStyle st;
        st.font = &LucarneFontBody;
        st.hasFont = true;
        st.color = color565(0, 0, 0);
        st.hasColor = true;
        w63.setItemStyle(0, st);
    }
    w64.setBounds(0, 63, 280, 42);
    w64.setFont(&LucarneFontBody);
    w64.setAlign(TextAlign::Center);
    w65.setBounds(108, 114, 64, 64);
    w66.setBounds(96, 74, 90, 90);
    w67.setBounds(0, 34, 280, 34);
    w67.setFont(&LucarneFontBody);
    w67.setAlign(TextAlign::Center);
    w68.setActiveFill(color565(235, 235, 235));
    w68.setActiveText(color565(0, 0, 0));
    w68.setInactiveFill(color565(52, 67, 96));
    w68.setInactiveText(color565(0, 0, 0));
    w68.setTextColor(color565(255, 255, 255));
    w68.addItem(BacLocale::lbl_back, nullptr, &screen_scr_mr15ivvsd, Transition::Inherit, MenuItemOpts{nullptr, true, 24, 0});
    {
        TextStyle st;
        st.font = &LucarneFontBody;
        st.hasFont = true;
        st.color = color565(0, 0, 0);
        st.hasColor = true;
        w68.setItemStyle(0, st);
    }
    w69.setBounds(108, 88, 64, 64);
    w70.setBounds(0, 34, 280, 26);
    w70.setFont(&LucarneFontBody);
    w70.setAlign(TextAlign::Center);
    w71.setBounds(0, 55, 280, 22);
    w71.setFont(&LucarneFontBody);
    w71.setAlign(TextAlign::Center);
    w72.setActiveFill(color565(235, 235, 235));
    w72.setActiveText(color565(0, 0, 0));
    w72.setInactiveFill(color565(52, 67, 96));
    w72.setInactiveText(color565(0, 0, 0));
    w72.setTextColor(color565(255, 255, 255));
    w72.addItem(BacLocale::lbl_back, nullptr, &screen_scr_mr15ivvsd, Transition::Inherit, MenuItemOpts{nullptr, true, 24, 0});
    {
        TextStyle st;
        st.font = &LucarneFontBody;
        st.hasFont = true;
        st.color = color565(0, 0, 0);
        st.hasColor = true;
        w72.setItemStyle(0, st);
    }
    w73.setBounds(140, 48, 113, 32);
    w73.setFont(&LucarneFontBody);
    w73.setAlign(TextAlign::Left);
    w74.setBounds(21, 48, 96, 32);
    w74.setFont(&LucarneFontBody);
    w74.setAlign(TextAlign::Left);
    w75.setBounds(21, 80, 96, 32);
    w75.setFont(&LucarneFontBody);
    w75.setAlign(TextAlign::Left);
    w76.setBounds(21, 112, 96, 32);
    w76.setFont(&LucarneFontBody);
    w76.setAlign(TextAlign::Left);
    w77.setBounds(21, 143, 96, 32);
    w77.setFont(&LucarneFontBody);
    w77.setAlign(TextAlign::Left);
    w78.setBounds(140, 80, 113, 32);
    w78.setFont(&LucarneFontBody);
    w78.setAlign(TextAlign::Left);
    w79.setBounds(140, 112, 113, 32);
    w79.setFont(&LucarneFontBody);
    w79.setAlign(TextAlign::Left);
    w80.setBounds(140, 144, 113, 32);
    w80.setFont(&LucarneFontBody);
    w80.setAlign(TextAlign::Left);
    w81.setActiveFill(color565(235, 235, 235));
    w81.setActiveText(color565(0, 0, 0));
    w81.setInactiveFill(color565(52, 67, 96));
    w81.setInactiveText(color565(0, 0, 0));
    w81.setTextColor(color565(255, 255, 255));
    w81.addItem(BacLocale::lbl_back, nullptr, &screen_scr_mr14c6nfb, Transition::Inherit, MenuItemOpts{nullptr, true, 24, 0});
    {
        TextStyle st;
        st.font = &LucarneFontBody;
        st.hasFont = true;
        st.color = color565(0, 0, 0);
        st.hasColor = true;
        w81.setItemStyle(0, st);
    }
    w82.setActiveFill(color565(235, 235, 235));
    w82.setActiveText(color565(0, 0, 0));
    w82.setInactiveFill(color565(52, 67, 96));
    w82.setInactiveText(color565(0, 0, 0));
    w82.setTextColor(color565(255, 255, 255));
    w82.addItem(BacLocale::lbl_confirm, "glyphs:check-double@w:w_mr172rxd32_it_mr172rxd33", &screen_scr_mr1760ww3i, Transition::Inherit, MenuItemOpts{nullptr, true, 24, 1});
    {
        TextStyle st;
        st.color = color565(0, 0, 0);
        st.hasColor = true;
        w82.setItemStyle(0, st);
    }
    w82.addItem(BacLocale::lbl_back, nullptr, &screen_scr_mr14c6nfb, Transition::Inherit, MenuItemOpts{nullptr, true, 24, 0});
    {
        TextStyle st;
        st.font = &LucarneFontBody;
        st.hasFont = true;
        st.color = color565(0, 0, 0);
        st.hasColor = true;
        w82.setItemStyle(1, st);
    }
    w83.setBounds(0, 37, 280, 35);
    w83.setFont(&LucarneFontBody);
    w83.setAlign(TextAlign::Center);
    w84.setBounds(0, 60, 280, 24);
    w84.setFont(&LucarneFontBody);
    w84.setAlign(TextAlign::Center);
    w85.setBounds(0, 90, 280, 21);
    w85.setFont(&LucarneFontBody);
    w85.setAlign(TextAlign::Center);
    w86.setBounds(0, 106, 280, 25);
    w86.setFont(&LucarneFontBody);
    w86.setAlign(TextAlign::Center);
    w87.setBounds(0, 27, 280, 42);
    w87.setFont(&Font_style_Fira_Sans_18_w400);
    w87.setAlign(TextAlign::Center);
    w88.setBounds(0, 184, 280, 27);
    w88.setFont(&LucarneFontBody);
    w88.setColor(color565(246, 4, 4));
    w88.setAlign(TextAlign::Center);
    w89.setShowValue(true);
    w89.setValueFont(&LucarneFontBody);
    w89.setValueColor(color565(0, 0, 0));
    w90.setBounds(0, 70, 280, 30);
    w90.setFont(&LucarneFontBody);
    w90.setAlign(TextAlign::Center);
    w91.setBounds(0, 96, 280, 28);
    w91.setFont(&LucarneFontBody);
    w91.setColor(color565(255, 0, 0));
    w91.setAlign(TextAlign::Center);
    w92.setShowValue(true);
    w92.setValueFont(&LucarneFontBody);
    w92.setValueColor(color565(0, 0, 0));

    screen_scr_mqwqhtj72.add(&w0);
    screen_scr_mqwqhtj72.add(&w1);
    screen_scr_mqwqhtj72.add(&w2);
    screen_scr_mqwqhtj72.add(&w3);
    screen_scr_mqwqhtj72.add(&w4);
    screen_scr_mqwqhtj72.add(&w5);
    screen_scr_mqwqhtj72.add(&w6);
    screen_scr_mqxozray1.add(&w7);
    screen_scr_mqxozray1.add(&w8);
    screen_scr_mqxozray1.add(&w9);
    screen_scr_mqxozray1.add(&w10);
    screen_scr_mqxp1a2f2.add(&w11);
    screen_scr_mqxp1a2f2.add(&w12);
    screen_scr_mqxp1a2f2.add(&w13);
    screen_scr_mqxp1a2f2.add(&w14);
    screen_scr_mqxp1a2f2.add(&w15);
    screen_scr_mqxp1ppa3.add(&w16);
    screen_scr_mqxp1ppa3.add(&w17);
    screen_scr_mqxp1ppa3.add(&w18);
    screen_scr_mqxp1ppa3.add(&w19);
    screen_scr_mqxp1ppa3.add(&w20);
    screen_scr_mqzwbobu5.add(&w21);
    screen_scr_mqzwbobu5.add(&w22);
    screen_scr_mqzwbobu5.add(&w23);
    screen_scr_mqzwbobu5.add(&w24);
    screen_scr_mqzwbobu5.add(&w25);
    screen_scr_mqzwqllfl.add(&w26);
    screen_scr_mqzwqllfl.add(&w27);
    screen_scr_mqzwqllfl.add(&w28);
    screen_scr_mqzwqllfl.add(&w29);
    screen_scr_mqzwqllfl.add(&w30);
    screen_scr_mqzx2k8qz.add(&w31);
    screen_scr_mqzx2k8qz.add(&w32);
    screen_scr_mqzx2k8qz.add(&w33);
    screen_scr_mqzx2k8qz.add(&w34);
    screen_scr_mqzxihlp18.add(&w35);
    screen_scr_mqzxihlp18.add(&w36);
    screen_scr_mqzxihlp18.add(&w37);
    screen_scr_mqzxihlp18.add(&w38);
    screen_scr_mqzxocmh1e.add(&w39);
    screen_scr_mqzxocmh1e.add(&w40);
    screen_scr_mqzxocmh1e.add(&w41);
    screen_scr_mqzxocmh1e.add(&w42);
    screen_scr_mqzyaiw41j.add(&w43);
    screen_scr_mqzyaiw41j.add(&w44);
    screen_scr_mqzyaiw41j.add(&w46);
    screen_scr_mr14c6nfb.add(&w48);
    screen_scr_mr14qsc4g.add(&w49);
    screen_scr_mr15ivvsd.add(&w50);
    screen_scr_mr15ivvsd.add(&w51);
    screen_scr_mr15nlgnn.add(&w52);
    screen_scr_mr15t4tyy.add(&w53);
    screen_scr_mr15t4tyy.add(&w54);
    screen_scr_mr15t4tyy.add(&w55);
    screen_scr_mr15t4tyy.add(&w56);
    screen_scr_mr15w6br17.add(&w57);
    screen_scr_mr15w6br17.add(&w58);
    screen_scr_mr163td21f.add(&w59);
    screen_scr_mr163td21f.add(&w60);
    screen_scr_mr163td21f.add(&w61);
    screen_scr_mr163td21f.add(&w62);
    screen_scr_mr163td21f.add(&w63);
    screen_scr_mr169o9w1o.add(&w64);
    screen_scr_mr169o9w1o.add(&w65);
    screen_scr_mr16b8yk1t.add(&w66);
    screen_scr_mr16b8yk1t.add(&w67);
    screen_scr_mr16b8yk1t.add(&w68);
    screen_scr_mr16dm621x.add(&w69);
    screen_scr_mr16dm621x.add(&w70);
    screen_scr_mr16dm621x.add(&w71);
    screen_scr_mr16dm621x.add(&w72);
    screen_scr_mr16kq912c.add(&w73);
    screen_scr_mr16kq912c.add(&w74);
    screen_scr_mr16kq912c.add(&w75);
    screen_scr_mr16kq912c.add(&w76);
    screen_scr_mr16kq912c.add(&w77);
    screen_scr_mr16kq912c.add(&w78);
    screen_scr_mr16kq912c.add(&w79);
    screen_scr_mr16kq912c.add(&w80);
    screen_scr_mr16kq912c.add(&w81);
    screen_scr_mr171rmq2y.add(&w82);
    screen_scr_mr171rmq2y.add(&w83);
    screen_scr_mr171rmq2y.add(&w84);
    screen_scr_mr171rmq2y.add(&w85);
    screen_scr_mr171rmq2y.add(&w86);
    screen_scr_mr1760ww3i.add(&w87);
    screen_scr_mr1760ww3i.add(&w88);
    screen_scr_mr1760ww3i.add(&w89);
    screen_scr_mr3hcyofj.add(&w90);
    screen_scr_mr3hcyofj.add(&w91);
    screen_scr_mr3hcyofj.add(&w92);

    ui.setString("bd_name_device", "lb_v01dev");
    ui.setFloat("ota_pct", 0.0f);

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
//   ST7789 display;
//   UI ui(display);
//   initSpiBus();
//   projet::initStorage();  // before display.begin()
//   display.begin(projet::displayPins(), projet::displayOptions(), buffer, &SPI);
//   projet::build(ui);
//   projet::attachInput(ui);
//   ui.begin();
//   void loop() { projet::update(); ui.update(); }

#endif