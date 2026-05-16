class_name LadderUI
extends RefCounted

# UI-Manager für die Ladder-Erstellung und -Verwaltung - SAUBERE VERSION

var config: LadderConfig
var parent_node: Control

# UI Komponenten Arrays
var level_containers: Array[HBoxContainer] = []
var level_bars: Array[Panel] = []
var level_bar_backgrounds: Array[StyleBoxFlat] = []
var gift_icons: Array[TextureRect] = []
var level_texts: Array[Label] = []
var timer_labels: Array[Label] = []

var main_container: VBoxContainer

func _init(parent: Control, ladder_config: LadderConfig):
	parent_node = parent
	config = ladder_config

func create_ui():
	print("🏗️ Erstelle Ladder UI...")
	setup_main_container()
	create_all_levels()
	print("✅ UI erstellt!")

func setup_main_container():
	# Altes UI löschen (außer HTTPServer)
	for child in parent_node.get_children():
		if child.name != "HTTPServer":
			child.queue_free()
	
	# Haupt-Container erstellen
	main_container = VBoxContainer.new()
	main_container.name = "MainContainer"
	main_container.anchors_preset = Control.PRESET_FULL_RECT
	main_container.add_theme_constant_override("separation", config.spacing_between_levels)
	parent_node.add_child(main_container)

func create_all_levels():
	# Arrays leeren
	level_containers.clear()
	level_bars.clear()
	level_bar_backgrounds.clear()
	gift_icons.clear()
	level_texts.clear()
	timer_labels.clear()
	
	# 12 Level erstellen (von 12KMH oben bis 1KMH unten)
	for i in range(12):
		var level_num = 12 - i  # 12, 11, 10, ..., 1
		create_single_level(i, level_num)

func create_single_level(index: int, level_num: int):
	# Haupt-Container für dieses Level (Horizontal)
	var level_container = HBoxContainer.new()
	level_container.name = "Level" + str(level_num)
	level_container.custom_minimum_size.y = config.bar_height + 10
	level_container.add_theme_constant_override("separation", 10)
	main_container.add_child(level_container)
	level_containers.append(level_container)
	
	# Gift Icon für DIESES Level (links vom Balken)
	var gift_icon = create_gift_icon("GiftIcon")
	level_container.add_child(gift_icon)
	gift_icons.append(gift_icon)
	
	# Timer Label (nur beim aktiven Level sichtbar)
	var timer_label = create_timer_label()
	level_container.add_child(timer_label)
	timer_labels.append(timer_label)
	
	# Level Balken mit StyleBox
	var level_bar = create_level_bar(level_num)
	level_container.add_child(level_bar)
	level_bars.append(level_bar)
	
	# Level Text INNERHALB des Balkens (mit Padding)
	var level_text = create_level_text(level_num, level_bar)
	level_texts.append(level_text)
	
	print("📊 Level " + str(level_num) + ": " + str(config.get_bar_width(level_num)) + "px breit")

func create_gift_icon(icon_name: String) -> TextureRect:
	var gift_icon = TextureRect.new()
	gift_icon.name = icon_name
	gift_icon.custom_minimum_size = Vector2(config.icon_size, config.icon_size)
	gift_icon.expand_mode = TextureRect.EXPAND_FIT_WIDTH_PROPORTIONAL
	gift_icon.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	return gift_icon

func create_timer_label() -> Label:
	var timer_label = Label.new()
	timer_label.name = "TimerLabel"
	timer_label.text = config.format_time(config.level_duration_seconds)
	timer_label.custom_minimum_size.x = 50
	
	# Text Styling anwenden
	apply_text_styling(timer_label, config.timer_text_size, config.timer_color)
	
	timer_label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	timer_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	timer_label.visible = false  # Standardmäßig versteckt
	return timer_label

func create_level_bar(level_num: int) -> Panel:
	var bar_width = config.get_bar_width(level_num)
	var level_bar = Panel.new()
	level_bar.name = "LevelBar"
	level_bar.custom_minimum_size = Vector2(bar_width, config.bar_height)
	
	# StyleBox für Border Radius erstellen
	var style_box = StyleBoxFlat.new()
	style_box.bg_color = config.get_level_color(level_num)
	style_box.corner_radius_top_left = config.bar_border_radius
	style_box.corner_radius_top_right = config.bar_border_radius
	style_box.corner_radius_bottom_left = config.bar_border_radius
	style_box.corner_radius_bottom_right = config.bar_border_radius
	
	level_bar.add_theme_stylebox_override("panel", style_box)
	level_bar_backgrounds.append(style_box)
	
	return level_bar

func create_level_text(level_num: int, parent_bar: Panel) -> Label:
	var level_text = Label.new()
	level_text.name = "LevelText"
	level_text.text = str(level_num) + "KMH"
	
	# Text Styling anwenden
	apply_text_styling(level_text, config.level_text_size, config.text_color)
	
	# Zentrierung
	level_text.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	level_text.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	
	# Mit 4-seitigem Padding für perfekte Zentrierung
	level_text.anchors_preset = Control.PRESET_FULL_RECT
	level_text.offset_left = config.bar_padding_left
	level_text.offset_right = -config.bar_padding_right
	level_text.offset_top = config.bar_padding_top
	level_text.offset_bottom = -config.bar_padding_bottom
	
	parent_bar.add_child(level_text)
	return level_text

func apply_text_styling(label: Label, font_size: int, font_color: Color):
	# Font Size
	label.add_theme_font_size_override("font_size", font_size)
	
	# Font Color
	label.add_theme_color_override("font_color", font_color)
	
	# Custom Font falls gesetzt
	if config.font_resource != null:
		label.add_theme_font_override("font", config.font_resource)
	
	# Text Shadow
	if config.text_shadow_enabled:
		label.add_theme_color_override("font_shadow_color", config.text_shadow_color)
		label.add_theme_constant_override("shadow_offset_x", int(config.text_shadow_offset.x))
		label.add_theme_constant_override("shadow_offset_y", int(config.text_shadow_offset.y))
	
	# Text Outline
	if config.text_outline_enabled:
		label.add_theme_color_override("font_outline_color", config.text_outline_color)
		label.add_theme_constant_override("outline_size", config.text_outline_size)

func update_display(current_level: int):
	reset_all_bars()
	highlight_active_level(current_level)
	show_goal_gifts(current_level)

func reset_all_bars():
	# Alle Balken und Timer zurücksetzen
	for i in range(level_bars.size()):
		var style_box = level_bar_backgrounds[i]
		style_box.bg_color = config.get_level_color(i + 1)
		reset_bar_outline(style_box)
		timer_labels[i].visible = false
	
	# Alle Geschenke verstecken
	for icon in gift_icons:
		icon.visible = false
		icon.texture = null

func reset_bar_outline(style_box: StyleBoxFlat):
	style_box.border_width_left = 0
	style_box.border_width_right = 0
	style_box.border_width_top = 0
	style_box.border_width_bottom = 0

func highlight_active_level(current_level: int):
	var display_index = 11 - current_level
	if display_index >= 0 and display_index < level_bars.size():
		# Aktiver Balken bekommt weißen Rahmen
		var active_style = level_bar_backgrounds[display_index]
		active_style.border_width_left = config.active_bar_outline_width
		active_style.border_width_right = config.active_bar_outline_width
		active_style.border_width_top = config.active_bar_outline_width
		active_style.border_width_bottom = config.active_bar_outline_width
		active_style.border_color = config.active_outline_color
		
		# Timer für dieses Level anzeigen
		if config.show_timer:
			timer_labels[display_index].visible = true

func show_goal_gifts(current_level: int):
	# Alle Geschenke erstmal verstecken
	for icon in gift_icons:
		icon.visible = false
	
	# Nur die benachbarten Level zeigen ihre Geschenke
	var current_level_1based = current_level + 1  # current_level ist 0-basiert, wir brauchen 1-basiert
	
	# Vorheriges Level (DOWN-Ziel) anzeigen
	if current_level > 0:  # Es gibt ein vorheriges Level
		var prev_level = current_level_1based - 1  # Das vorherige Level (1-basiert)
		var prev_level_display_index = 12 - prev_level  # Display-Index für dieses Level
		
		if prev_level_display_index >= 0 and prev_level_display_index < gift_icons.size():
			var gift_index = prev_level - 1  # Array-Index für gift_textures (0-basiert)
			if gift_index < config.gift_textures.size() and config.gift_textures[gift_index] != null:
				gift_icons[prev_level_display_index].texture = config.gift_textures[gift_index]
				gift_icons[prev_level_display_index].visible = true
				print("🎁 DOWN-Ziel: Level " + str(prev_level) + " Geschenk sichtbar")
	
	# Nächstes Level (UP-Ziel) anzeigen
	if current_level < 11:  # Es gibt ein nächstes Level
		var next_level = current_level_1based + 1  # Das nächste Level (1-basiert)
		var next_level_display_index = 12 - next_level  # Display-Index für dieses Level
		
		if next_level_display_index >= 0 and next_level_display_index < gift_icons.size():
			var gift_index = next_level - 1  # Array-Index für gift_textures (0-basiert)
			if gift_index < config.gift_textures.size() and config.gift_textures[gift_index] != null:
				gift_icons[next_level_display_index].texture = config.gift_textures[gift_index]
				gift_icons[next_level_display_index].visible = true
				print("🎁 UP-Ziel: Level " + str(next_level) + " Geschenk sichtbar")
	
	print("📍 Aktuell Level " + str(current_level_1based) + " - Geschenke bei benachbarten Levels")

func update_timer_display(current_level: int, time_left: float, is_stopped: bool):
	var display_index = 11 - current_level
	if display_index >= 0 and display_index < timer_labels.size():
		var timer_label = timer_labels[display_index]
		if is_stopped:
			timer_label.text = "STOP"
		else:
			timer_label.text = config.format_time(time_left)
