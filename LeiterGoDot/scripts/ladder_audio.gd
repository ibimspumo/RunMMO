extends Control

# =============== HAUPT-CONTROLLER ===============
# Koordiniert alle Ladder-Module und hält die Export-Variablen

# =============== EXPORT GRUPPEN ===============
@export_group("Geschenke Grafiken (12 Stück - von 1KMH bis 12KMH)")
@export var gift_1kmh: Texture2D
@export var gift_2kmh: Texture2D
@export var gift_3kmh: Texture2D
@export var gift_4kmh: Texture2D
@export var gift_5kmh: Texture2D
@export var gift_6kmh: Texture2D
@export var gift_7kmh: Texture2D
@export var gift_8kmh: Texture2D
@export var gift_9kmh: Texture2D
@export var gift_10kmh: Texture2D
@export var gift_11kmh: Texture2D
@export var gift_12kmh: Texture2D

@export_group("Audio Einstellungen")
@export var sound_up: AudioStream
@export var sound_down: AudioStream
@export var volume_db: float = 0.0

@export_group("Timer Einstellungen")
@export var level_duration_seconds: float = 5.0
@export var show_timer: bool = true

@export_group("Webhook Einstellungen")
@export var webhook_port: int = 8080
@export var webhook_enabled: bool = true

@export_group("Balken Farben (12 individuelle Farben)")
@export var color_1kmh: Color = Color(0.8, 0.2, 0.2, 1.0)
@export var color_2kmh: Color = Color(0.9, 0.4, 0.2, 1.0)
@export var color_3kmh: Color = Color(1.0, 0.5, 0.0, 1.0)
@export var color_4kmh: Color = Color(1.0, 0.7, 0.0, 1.0)
@export var color_5kmh: Color = Color(1.0, 0.9, 0.0, 1.0)
@export var color_6kmh: Color = Color(0.8, 1.0, 0.0, 1.0)
@export var color_7kmh: Color = Color(0.5, 1.0, 0.0, 1.0)
@export var color_8kmh: Color = Color(0.0, 1.0, 0.5, 1.0)
@export var color_9kmh: Color = Color(0.0, 0.8, 1.0, 1.0)
@export var color_10kmh: Color = Color(0.0, 0.5, 1.0, 1.0)
@export var color_11kmh: Color = Color(0.4, 0.0, 1.0, 1.0)
@export var color_12kmh: Color = Color(0.8, 0.0, 1.0, 1.0)

@export_group("Text Styling")
@export var font_resource: FontFile
@export var level_text_size: int = 16
@export var timer_text_size: int = 14
@export var text_shadow_enabled: bool = true
@export var text_shadow_color: Color = Color(0, 0, 0, 0.8)
@export var text_shadow_offset: Vector2 = Vector2(2, 2)
@export var text_outline_enabled: bool = true
@export var text_outline_color: Color = Color(0, 0, 0, 1.0)
@export var text_outline_size: int = 1

@export_group("Sonstige Farben")
@export var inactive_bar_color: Color = Color(0.2, 0.2, 0.2, 1.0)
@export var active_outline_color: Color = Color(1.0, 1.0, 1.0, 1.0)
@export var text_color: Color = Color.WHITE
@export var timer_color: Color = Color.CYAN

@export_group("Layout Einstellungen")
@export var bar_base_width: int = 200
@export var bar_width_increment: int = 50
@export var bar_height: int = 35
@export var bar_border_radius: int = 8
@export var bar_padding_top: int = 5
@export var bar_padding_bottom: int = 5
@export var bar_padding_left: int = 10
@export var bar_padding_right: int = 10
@export var icon_size: int = 30
@export var spacing_between_levels: int = 3
@export var active_bar_outline_width: int = 3

# =============== MODULE ===============
var config: LadderConfig
var ui_manager: LadderUI
var timer_manager: LadderTimer
var audio_manager: LadderAudio
var webhook_manager: LadderWebhook

func _ready():
	print("🚀 Starte Ladder System...")
	
	# Konfiguration erstellen und übertragen
	create_configuration()
	
	# Module initialisieren
	initialize_modules()
	
	# Event-Verbindungen erstellen
	connect_signals()
	
	# System starten
	start_system()
	
	print("✅ Ladder System bereit!")

func create_configuration():
	config = LadderConfig.new()
	
	# Export-Variablen in Config übertragen
	transfer_exports_to_config()
	
	# Konfiguration validieren
	if not config.validate_config():
		print("⚠️ Konfiguration hat Probleme!")

func transfer_exports_to_config():
	# Geschenke übertragen
	config.gift_textures = [
		gift_1kmh, gift_2kmh, gift_3kmh, gift_4kmh,
		gift_5kmh, gift_6kmh, gift_7kmh, gift_8kmh,
		gift_9kmh, gift_10kmh, gift_11kmh, gift_12kmh
	]
	
	# Audio
	config.sound_up = sound_up
	config.sound_down = sound_down
	config.volume_db = volume_db
	
	# Timer
	config.level_duration_seconds = level_duration_seconds
	config.show_timer = show_timer
	
	# Webhook
	config.webhook_port = webhook_port
	config.webhook_enabled = webhook_enabled
	
	# Text Styling
	config.font_resource = font_resource
	config.level_text_size = level_text_size
	config.timer_text_size = timer_text_size
	config.text_shadow_enabled = text_shadow_enabled
	config.text_shadow_color = text_shadow_color
	config.text_shadow_offset = text_shadow_offset
	config.text_outline_enabled = text_outline_enabled
	config.text_outline_color = text_outline_color
	config.text_outline_size = text_outline_size
	
	# Farben
	config.level_colors = [
		color_1kmh, color_2kmh, color_3kmh, color_4kmh,
		color_5kmh, color_6kmh, color_7kmh, color_8kmh,
		color_9kmh, color_10kmh, color_11kmh, color_12kmh
	]
	
	config.inactive_bar_color = inactive_bar_color
	config.active_outline_color = active_outline_color
	config.text_color = text_color
	config.timer_color = timer_color
	
	# Layout
	config.bar_base_width = bar_base_width
	config.bar_width_increment = bar_width_increment
	config.bar_height = bar_height
	config.bar_border_radius = bar_border_radius
	config.bar_padding_top = bar_padding_top
	config.bar_padding_bottom = bar_padding_bottom
	config.bar_padding_left = bar_padding_left
	config.bar_padding_right = bar_padding_right
	config.icon_size = icon_size
	config.spacing_between_levels = spacing_between_levels
	config.active_bar_outline_width = active_bar_outline_width

func initialize_modules():
	print("🔧 Initialisiere Module...")
	
	# Zuerst UI erstellen (damit der Scene Tree bereit ist)
	ui_manager = LadderUI.new(self, config)
	
	# Timer-Manager
	timer_manager = LadderTimer.new(self, config)
	
	# Audio-Manager (nach UI, damit der Scene Tree stabil ist)  
	audio_manager = LadderAudio.new(self, config)
	
	# Webhook-Manager (als letztes)
	webhook_manager = LadderWebhook.new(self, config)
	webhook_manager.set_timer_manager(timer_manager)
	
	print("✅ Alle Module initialisiert")

func connect_signals():
	# Timer-Events
	timer_manager.level_changed.connect(_on_level_changed)
	timer_manager.timer_expired.connect(_on_timer_expired)
	timer_manager.level_maxed.connect(_on_level_maxed)
	timer_manager.level_minimized.connect(_on_level_minimized)
	
	# Webhook-Events
	webhook_manager.webhook_up_received.connect(_on_webhook_up)
	webhook_manager.webhook_down_received.connect(_on_webhook_down)
	webhook_manager.webhook_status_requested.connect(_on_webhook_status)

func start_system():
	# UI erstellen
	ui_manager.create_ui()
	
	# Webhook-Server starten
	webhook_manager.setup_server()
	
	# Timer initial starten
	if timer_manager:
		timer_manager.start_timer()
	
	# Initiale Anzeige
	update_display()

func update_display():
	var current_level = timer_manager.get_current_level()
	ui_manager.update_display(current_level)

# =============== EVENT HANDLERS ===============
func _on_level_changed(new_level: int):
	update_display()
	
	# Sound Debug-Info
	print("🔊 Level geändert - prüfe Sounds...")
	print("   - Sound Up: ", config.sound_up != null)
	print("   - Sound Down: ", config.sound_down != null)
	print("   - Audio Manager: ", audio_manager != null)
	
	# Sound abspielen je nach Richtung
	var old_level = timer_manager.current_level  # Das war der vorherige Level
	if old_level < new_level:  # Level ging hoch
		print("   -> Spiele UP Sound")
		if audio_manager:
			audio_manager.play_up_sound()
	else:  # Level ging runter
		print("   -> Spiele DOWN Sound")
		if audio_manager:
			audio_manager.play_down_sound()

func _on_timer_expired():
	print("⏰ Timer abgelaufen!")

func _on_level_maxed():
	print("🏆 Maximales Level erreicht!")

func _on_level_minimized():
	print("📉 Minimales Level erreicht!")

func _on_webhook_up():
	print("📡 Webhook UP empfangen")

func _on_webhook_down():
	print("📡 Webhook DOWN empfangen")

func _on_webhook_status():
	print("📡 Webhook STATUS angefragt")

# =============== GAME LOOP ===============
func _process(_delta):
	# Timer-Anzeige live aktualisieren
	if config and config.show_timer and timer_manager:
		var current_level = timer_manager.get_current_level()
		var time_left = timer_manager.get_time_left()
		var is_stopped = not timer_manager.is_timer_running()
		if ui_manager:
			ui_manager.update_timer_display(current_level, time_left, is_stopped)
	
	# Webhook-Requests verarbeiten
	if webhook_manager:
		webhook_manager.process_requests()

# =============== TEST-FUNKTIONEN (Tasten im Editor) ===============
func _input(event):
	if event is InputEventKey and event.pressed:
		if not timer_manager:
			return
			
		match event.keycode:
			KEY_UP, KEY_W:
				timer_manager.move_up()
			KEY_DOWN, KEY_S:
				timer_manager.move_down()
			KEY_R:
				timer_manager.reset_level()
				update_display()
			KEY_T:
				if timer_manager.is_timer_running():
					timer_manager.stop_timer()
				else:
					timer_manager.start_timer()
			KEY_P:
				timer_manager.print_status()
			KEY_H:
				print_help()

func print_help():
	print("🎮 STEUERUNG:")
	print("   ↑/W: Level hoch")
	print("   ↓/S: Level runter") 
	print("   R: Reset auf Level 1")
	print("   T: Timer start/stop")
	print("   P: Status ausgeben")
	print("   H: Diese Hilfe")

# =============== CLEANUP ===============
func _exit_tree():
	print("🛑 Ladder System wird beendet...")
	
	# Timer sauber beenden
	if timer_manager:
		timer_manager.cleanup()
	
	if webhook_manager:
		webhook_manager.shutdown()
	
	print("🛑 Ladder System beendet")
