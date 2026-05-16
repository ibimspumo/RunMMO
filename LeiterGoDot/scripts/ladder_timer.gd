class_name LadderTimer
extends RefCounted

# Timer-Manager für Level-Logik und Countdown - SAUBERE Version

signal level_changed(new_level: int)
signal timer_expired()
signal level_maxed()
signal level_minimized()

var config: LadderConfig
var level_timer: Timer
var parent_node: Node

var current_level: int = 0  # 0 = 1KMH, 11 = 12KMH
var timer_is_valid: bool = false

func _init(parent: Node, ladder_config: LadderConfig):
	parent_node = parent
	config = ladder_config
	setup_timer()

func setup_timer():
	print("🔧 Timer wird erstellt...")
	print("🔍 Parent Node: ", parent_node)
	print("🔍 Parent Node valid: ", parent_node and is_instance_valid(parent_node))
	
	# Alten Timer löschen falls vorhanden
	destroy_timer()
	
	# Neuen Timer erstellen
	if parent_node and is_instance_valid(parent_node):
		level_timer = Timer.new()
		level_timer.name = "LevelTimer"
		level_timer.wait_time = config.level_duration_seconds
		level_timer.one_shot = true
		level_timer.timeout.connect(_on_timer_timeout)
		
		parent_node.add_child(level_timer)
		timer_is_valid = true
		
		print("✅ Timer erstellt mit " + str(config.level_duration_seconds) + " Sekunden")
		print("🔍 Timer erstellt: ", level_timer)
		print("🔍 Timer im Tree: ", level_timer.is_inside_tree())
	else:
		print("❌ Fehler: Parent Node nicht verfügbar für Timer")
		timer_is_valid = false

func destroy_timer():
	if level_timer and is_instance_valid(level_timer):
		if level_timer.timeout.is_connected(_on_timer_timeout):
			level_timer.timeout.disconnect(_on_timer_timeout)
		level_timer.queue_free()
		level_timer = null
		timer_is_valid = false
		print("🗑️ Timer zerstört")

func is_timer_valid() -> bool:
	return level_timer != null and is_instance_valid(level_timer) and timer_is_valid

func start_timer():
	print("🔍 Start Timer Debug:")
	print("   - Timer object: ", level_timer)
	print("   - Timer valid (object): ", level_timer != null and is_instance_valid(level_timer))
	print("   - Timer valid (flag): ", timer_is_valid)
	print("   - is_timer_valid(): ", is_timer_valid())
	
	if is_timer_valid():
		level_timer.start(config.level_duration_seconds)
		print("▶️ Timer gestartet für Level " + str(current_level + 1) + "KMH")
		print("🔍 Timer nach Start - Running: ", not level_timer.is_stopped())
	else:
		print("⚠️ Timer nicht verfügbar - kann nicht starten")
		# Versuche Timer neu zu erstellen
		print("🔄 Versuche Timer neu zu erstellen...")
		setup_timer()
		if is_timer_valid():
			level_timer.start(config.level_duration_seconds)
			print("✅ Timer neu erstellt und gestartet!")

func stop_timer():
	if is_timer_valid():
		level_timer.stop()
		print("⏸️ Timer gestoppt")
	else:
		print("⚠️ Timer nicht verfügbar - kann nicht stoppen")

func restart_timer():
	print("🔄 Restart Timer aufgerufen")
	if is_timer_valid():
		level_timer.start(config.level_duration_seconds)
		print("✅ Timer neu gestartet")
	else:
		print("⚠️ Timer nicht verfügbar - kann nicht neu starten")
		start_timer()  # Versuche normalen Start

func is_timer_running() -> bool:
	if is_timer_valid():
		return not level_timer.is_stopped()
	return false

func get_time_left() -> float:
	if is_timer_valid():
		return level_timer.time_left
	return 0.0

func move_up() -> bool:
	if current_level < 11:  # Max Level 11 (12KMH)
		current_level += 1
		restart_timer()
		level_changed.emit(current_level)
		print("🔥 Level UP! Jetzt bei: " + str(current_level + 1) + "KMH")
		return true
	else:
		level_maxed.emit()
		print("⚠️ Bereits auf Maximum Level!")
		return false

func move_down() -> bool:
	if current_level > 0:  # Min Level 0 (1KMH)
		current_level -= 1
		restart_timer()
		level_changed.emit(current_level)
		print("📉 Level DOWN! Jetzt bei: " + str(current_level + 1) + "KMH")
		return true
	else:
		level_minimized.emit()
		print("⚠️ Bereits auf Minimum Level!")
		return false

func reset_level():
	current_level = 0
	stop_timer()
	level_changed.emit(current_level)
	print("🔄 Reset auf Level 1")

func get_current_level() -> int:
	return current_level

func get_current_level_name() -> String:
	return str(current_level + 1) + "KMH"

func _on_timer_timeout():
	# Zusätzliche Validierung im Timeout
	if not is_timer_valid():
		print("⚠️ Timer-Timeout aber Timer nicht mehr gültig")
		return
	
	print("⏰ Timer abgelaufen! Level runter...")
	timer_expired.emit()
	move_down()

# Debug und Status-Funktionen
func get_status() -> Dictionary:
	return {
		"current_level": current_level + 1,
		"current_level_name": get_current_level_name(),
		"time_left": get_time_left(),
		"is_running": is_timer_running(),
		"timer_valid": is_timer_valid(),
		"max_level": 12
	}

func print_status():
	var status = get_status()
	print("📊 Status: Level " + str(status.current_level) + 
		  ", Timer: " + config.format_time(status.time_left) + 
		  ", Running: " + str(status.is_running) +
		  ", Valid: " + str(status.timer_valid))

# Cleanup-Funktion für das Main-System
func cleanup():
	destroy_timer()
