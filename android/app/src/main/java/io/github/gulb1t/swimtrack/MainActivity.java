package io.github.gulb1t.swimtrack;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // SwimTrack's own plugins (the npm ones register themselves).
        registerPlugin(VaultPlugin.class);
        registerPlugin(DevicePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
