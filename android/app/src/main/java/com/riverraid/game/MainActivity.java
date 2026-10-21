package com.riverraid.game;

import android.app.Activity;
import android.os.Bundle;
import android.view.InputDevice;
import android.view.KeyEvent;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.webkit.WebSettings;
import android.webkit.WebView;

// O app é só uma "moldura": um WebView em tela cheia que abre o jogo HTML/JS
// copiado para assets/www pelo script scripts/export-android.sh.
// O parâmetro ?touch=1 força os controles na tela (js/touch.js).
public class MainActivity extends Activity {
    private WebView web;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        web = new WebView(this);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setAllowFileAccess(true);
        s.setDomStorageEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        web.setBackgroundColor(0xFF0C0F1C);
        setContentView(web);
        hideBars();
        web.loadUrl("file:///android_asset/www/index.html?touch=1");
    }

    private void hideBars() {
        web.setSystemUiVisibility(View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY | View.SYSTEM_UI_FLAG_FULLSCREEN
                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN);
    }

    @Override
    public void onWindowFocusChanged(boolean focus) { super.onWindowFocusChanged(focus); if (focus) hideBars(); }

    // ---- controle físico (Bluetooth/USB): repassa botões e analógico para o jogo (js/gamepad.js) ----
    private static boolean fromPad(int src) {
        return (src & InputDevice.SOURCE_GAMEPAD) == InputDevice.SOURCE_GAMEPAD
            || (src & InputDevice.SOURCE_JOYSTICK) == InputDevice.SOURCE_JOYSTICK
            || (src & InputDevice.SOURCE_DPAD) == InputDevice.SOURCE_DPAD;
    }

    // LB e LT seguem também com o nome, para o combo LB + LT (1 s) = menu principal
    private static String comboName(int code) {
        return code == KeyEvent.KEYCODE_BUTTON_L1 ? ",'LB'" : code == KeyEvent.KEYCODE_BUTTON_L2 ? ",'LT'" : "";
    }

    private static String keyFor(int code) {
        switch (code) {
            case KeyEvent.KEYCODE_BUTTON_A: case KeyEvent.KEYCODE_BUTTON_R2: case KeyEvent.KEYCODE_DPAD_CENTER: return " ";
            case KeyEvent.KEYCODE_BUTTON_B: case KeyEvent.KEYCODE_BUTTON_L2: case KeyEvent.KEYCODE_BACK: return "b";   // B / gatilho esq.: bomba (B não fecha o app)
            case KeyEvent.KEYCODE_BUTTON_X: return "-";
            case KeyEvent.KEYCODE_BUTTON_Y: return "+";
            case KeyEvent.KEYCODE_BUTTON_L1: return "PageDown";
            case KeyEvent.KEYCODE_BUTTON_R1: return "PageUp";
            case KeyEvent.KEYCODE_BUTTON_START: return "Enter";
            case KeyEvent.KEYCODE_ESCAPE: return "Escape";
            case KeyEvent.KEYCODE_DPAD_UP: return "ArrowUp";
            case KeyEvent.KEYCODE_DPAD_DOWN: return "ArrowDown";
            case KeyEvent.KEYCODE_DPAD_LEFT: return "ArrowLeft";
            case KeyEvent.KEYCODE_DPAD_RIGHT: return "ArrowRight";
            default: return null;
        }
    }

    @Override
    public boolean dispatchKeyEvent(KeyEvent e) {
        if (fromPad(e.getSource())) {
            String k = keyFor(e.getKeyCode());
            if (k != null) {
                boolean down = e.getAction() == KeyEvent.ACTION_DOWN;
                if (!down || e.getRepeatCount() == 0)
                    web.evaluateJavascript("window.nativePad&&nativePad('" + k + "'," + down + comboName(e.getKeyCode()) + ")", null);
                return true;
            }
        }
        return super.dispatchKeyEvent(e);
    }

    @Override
    public boolean dispatchGenericMotionEvent(MotionEvent e) {
        if ((e.getSource() & InputDevice.SOURCE_JOYSTICK) == InputDevice.SOURCE_JOYSTICK && e.getAction() == MotionEvent.ACTION_MOVE) {
            // analógico, cruz (HAT) e gatilhos analógicos (LTRIGGER/BRAKE = bomba, RTRIGGER/GAS = fogo)
            float lt = Math.max(e.getAxisValue(MotionEvent.AXIS_LTRIGGER), e.getAxisValue(MotionEvent.AXIS_BRAKE));
            float rt = Math.max(e.getAxisValue(MotionEvent.AXIS_RTRIGGER), e.getAxisValue(MotionEvent.AXIS_GAS));
            web.evaluateJavascript("window.nativeAxes&&nativeAxes(" + e.getAxisValue(MotionEvent.AXIS_X) + "," + e.getAxisValue(MotionEvent.AXIS_Y) + ","
                + e.getAxisValue(MotionEvent.AXIS_HAT_X) + "," + e.getAxisValue(MotionEvent.AXIS_HAT_Y) + "," + lt + "," + rt + ")", null);
            return true;
        }
        return super.dispatchGenericMotionEvent(e);
    }

    @Override protected void onPause() { super.onPause(); web.onPause(); }
    @Override protected void onResume() { super.onResume(); web.onResume(); }
}
