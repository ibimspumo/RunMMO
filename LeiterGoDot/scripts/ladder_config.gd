class_name LadderConfig
extends RefCounted

# Diese Klasse hält alle Konfigurationsdaten und Export-Variablen
# Wird vom Haupt-Controller verwendet

# =============== GESCHENKE GRAFIKEN ===============
var gift_textures: Array[Texture2D] = []

# =============== AUDIO =============== 
var sound_up: AudioStream
var sound_down: AudioStream
var volume_db: float = 0.0  # -80.0 (stumm) bis +24.0 (sehr laut)

# =============== TIMER ===============
var level_duration_seconds: float = 5.0
var show_timer: bool = true

# =============== WEBHOOK ===============
var webhook_port: int = 8080
var webhook_enabled: bool = true
var webhook_bind_all_interfaces: bool = true  # Wenn true, lauscht auf 0.0.0.0 (alle IPs)

# =============== BALKEN FARBEN ===============
var level_colors: Array[Color] = [
	Color(0.8, 0.2, 0.2, 1.0),   # 1KMH - Rot
	Color(0.9, 0.4, 0.2, 1.0),   # 2KMH - Orange-Rot
	Color(1.0, 0.5, 0.0, 1.0),   # 3KMH - Orange
	Color(1.0, 0.7, 0.0, 1.0),   # 4KMH - Gelb-Orange
	Color(1.0, 0.9, 0.0, 1.0),   # 5KMH - Gelb
	Color(0.8, 1.0, 0.0, 1.0),   # 6KMH - Gelbgrün
	Color(0.5, 1.0, 0.0, 1.0),   # 7KMH - Hellgrün
	Color(0.0, 1.0, 0.5, 1.0),   # 8KMH - Grün
	Color(0.0, 0.8, 1.0, 1.0),   # 9KMH - Cyan
	Color(0.0, 0.5, 1.0, 1.0),   # 10KMH - Blau
	Color(0.4, 0.0, 1.0, 1.0),   # 11KMH - Violett
	Color(0.8, 0.0, 1.0, 1.0)    # 12KMH - Magenta
]

# =============== TEXT STYLING ===============
var font_resource: FontFile
var level_text_size: int = 16
var timer_text_size: int = 14
var text_shadow_enabled: bool = true
var text_shadow_color: Color = Color(0, 0, 0, 0.8)
var text_shadow_offset: Vector2 = Vector2(2, 2)
var text_outline_enabled: bool = true
var text_outline_color: Color = Color(0, 0, 0, 1.0)
var text_outline_size: int = 1

# =============== SONSTIGE FARBEN ===============
var inactive_bar_color: Color = Color(0.2, 0.2, 0.2, 1.0)
var active_outline_color: Color = Color(1.0, 1.0, 1.0, 1.0)
var text_color: Color = Color.WHITE
var timer_color: Color = Color.CYAN

# =============== LAYOUT ===============
var bar_base_width: int = 200
var bar_width_increment: int = 50
var bar_height: int = 35
var bar_border_radius: int = 8
var bar_padding_top: int = 5
var bar_padding_bottom: int = 5
var bar_padding_left: int = 10
var bar_padding_right: int = 10
var icon_size: int = 30
var spacing_between_levels: int = 3
var active_bar_outline_width: int = 3

# =============== FUNKTIONEN ===============
func get_bar_width(level_num: int) -> int:
	return bar_base_width + (level_num - 1) * bar_width_increment

func get_level_color(level_num: int) -> Color:
	if level_num >= 1 and level_num <= 12:
		return level_colors[level_num - 1]
	return inactive_bar_color

func format_time(seconds: float) -> String:
	var mins = int(seconds) / 60
	var secs = int(seconds) % 60
	return "%d:%02d" % [mins, secs]

func validate_config() -> bool:
	# Überprüft ob alle notwendigen Konfigurationen gesetzt sind
	if gift_textures.size() != 12:
		print("⚠️ Warnung: Nicht alle 12 Geschenk-Texturen gesetzt")
	
	if level_colors.size() != 12:
		print("❌ Fehler: Level-Farben Array hat falsche Größe")
		return false
	
	return true
