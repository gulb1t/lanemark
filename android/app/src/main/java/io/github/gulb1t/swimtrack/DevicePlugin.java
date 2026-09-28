package io.github.gulb1t.swimtrack;

import android.content.Context;
import android.os.Bundle;
import android.os.CancellationSignal;
import android.os.ParcelFileDescriptor;
import android.print.PageRange;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.view.WindowManager;
import android.webkit.WebView;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** What the web view can't do on its own: print, and keep the screen on during attendance. */
@CapacitorPlugin(name = "Device")
public class DevicePlugin extends Plugin {

    /**
     * Prints the page as it looks in print (the report cards the app has laid out), through Android's print screen:
     * any nearby printer, or "Save as PDF". Resolves once that screen closes, so the app can tidy up.
     */
    @PluginMethod
    public void print(PluginCall call) {
        String name = call.getString("name", "SwimTrack");
        getActivity().runOnUiThread(() -> {
            try {
                WebView web = getBridge().getWebView();
                PrintDocumentAdapter inner = web.createPrintDocumentAdapter(name);
                PrintDocumentAdapter adapter = new PrintDocumentAdapter() {
                    @Override
                    public void onStart() {
                        inner.onStart();
                    }

                    @Override
                    public void onLayout(PrintAttributes old, PrintAttributes next, CancellationSignal cancel, LayoutResultCallback cb, Bundle extras) {
                        inner.onLayout(old, next, cancel, cb, extras);
                    }

                    @Override
                    public void onWrite(PageRange[] pages, ParcelFileDescriptor dest, CancellationSignal cancel, WriteResultCallback cb) {
                        inner.onWrite(pages, dest, cancel, cb);
                    }

                    @Override
                    public void onFinish() {
                        inner.onFinish();
                        call.resolve();
                    }
                };
                PrintManager printer = (PrintManager) getActivity().getSystemService(Context.PRINT_SERVICE);
                printer.print(name, adapter, new PrintAttributes.Builder().setMediaSize(PrintAttributes.MediaSize.NA_LETTER).build());
            } catch (Exception e) {
                call.reject("Printing isn't available: " + e.getMessage());
            }
        });
    }

    /** Only while SwimTrack is on screen; Android clears it when the app goes to the background. */
    @PluginMethod
    public void keepAwake(PluginCall call) {
        boolean on = Boolean.TRUE.equals(call.getBoolean("on", false));
        getActivity().runOnUiThread(() -> {
            if (on) getActivity().getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            else getActivity().getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            call.resolve();
        });
    }
}
