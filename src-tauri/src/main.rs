// Verhindert ein zusätzliches Konsolen-Fenster auf Windows im Release-Build
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    runmmo_lib::run();
}
