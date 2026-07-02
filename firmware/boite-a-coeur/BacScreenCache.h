#pragma once

#include "Projet.h"

class BacScreenCache {
public:
    static const uint8_t QUEUE_MAX = 8;
    static const uint8_t WARMED_MAX = 16;

    void begin(lucarne::UI &ui, lucarne::Screen *splash) {
        _ui = &ui;
        _splash = splash;
        _bootIndex = 0;
        _bootDone = false;
        _queueCount = 0;
        _warmedCount = 0;
        _lastLazyMs = 0;
    }

    bool tickBoot(lucarne::Screen **list, size_t count) {
        if (_bootDone) return true;
        if (!_ui || !_splash || !list) return true;

        if (_bootIndex < count) {
            warmAssets(list[_bootIndex], _splash);
            _bootIndex++;
            return false;
        }

        _bootDone = true;
        restoreBuffer(_splash);
        return true;
    }

    void queue(lucarne::Screen *screen) {
        if (!screen || isWarmed(screen)) return;
        for (size_t i = 0; i < _queueCount; i++) {
            if (_queue[i] == screen) return;
        }
        if (_queueCount < QUEUE_MAX) {
            _queue[_queueCount++] = screen;
        }
    }

    void tickLazy(lucarne::Screen *visible, bool eager = false) {
        if (_queueCount == 0 || !visible || !_ui) return;

        uint32_t now = millis();
        if (!eager && now - _lastLazyMs < 400) return;
        _lastLazyMs = now;

        lucarne::Screen *target = _queue[0];
        for (size_t i = 1; i < _queueCount; i++) {
            _queue[i - 1] = _queue[i];
        }
        _queueCount--;

        warmAssets(target, visible);
    }

    void onVisible(lucarne::Screen *screen) {
        if (!screen) return;

        if (screen == &projet::screen_scr_mqxp1a2f2) {
            queue(&projet::screen_scr_mqzwbobu5);
        } else if (screen == &projet::screen_scr_mqzwbobu5) {
            queue(&projet::screen_scr_mqzwqllfl);
        } else if (screen == &projet::screen_scr_mqzwqllfl) {
            queue(&projet::screen_scr_mqzxocmh1e);
        } else if (screen == &projet::screen_scr_mqzx2k8qz) {
            queue(&projet::screen_scr_mqzyaiw41j);
        } else if (screen == &projet::screen_scr_mqzxocmh1e) {
            queue(&projet::screen_scr_mqzx2k8qz);
            queue(&projet::screen_scr_mqzxihlp18);
        } else if (screen == &projet::screen_scr_mqwqhtj72) {
            queue(&projet::screen_scr_mqzxocmh1e);
            queue(&projet::screen_scr_mqzxihlp18);
        }
    }

    bool isWarmed(lucarne::Screen *screen) const {
        if (!screen) return false;
        for (size_t i = 0; i < _warmedCount; i++) {
            if (_warmed[i] == screen) return true;
        }
        return false;
    }

    void warmIfNeeded(lucarne::Screen *target, lucarne::Screen *restore) {
        if (!target || !_ui || isWarmed(target)) return;
        warmAssets(target, restore ? restore : target);
    }

private:
    void warmAssets(lucarne::Screen *target, lucarne::Screen *restore) {
        if (!target || !_ui) return;
        target->draw(_ui->display(), _ui->theme(), _ui->store());
        _ui->store().clearDirty();
        markWarmed(target);
        restoreBuffer(restore);
        yield();
    }

    void restoreBuffer(lucarne::Screen *screen) {
        if (!screen || !_ui) return;
        screen->draw(_ui->display(), _ui->theme(), _ui->store());
        _ui->store().clearDirty();
    }

    void markWarmed(lucarne::Screen *screen) {
        if (!screen || isWarmed(screen)) return;
        if (_warmedCount < WARMED_MAX) {
            _warmed[_warmedCount++] = screen;
        }
    }

    lucarne::UI *_ui = nullptr;
    lucarne::Screen *_splash = nullptr;
    lucarne::Screen *_queue[QUEUE_MAX];
    lucarne::Screen *_warmed[WARMED_MAX];
    size_t _bootIndex = 0;
    size_t _queueCount = 0;
    size_t _warmedCount = 0;
    uint32_t _lastLazyMs = 0;
    bool _bootDone = false;
};
