class_name LadderWebhook
extends RefCounted

# Webhook-Server für externe Level-Steuerung

signal webhook_up_received()
signal webhook_down_received()
signal webhook_status_requested()
signal webhook_gift_received(level: int)

var config: LadderConfig
var http_server: TCPServer
var parent_node: Node
var timer_manager: LadderTimer

func _init(parent: Node, ladder_config: LadderConfig):
	parent_node = parent
	config = ladder_config

func set_timer_manager(timer: LadderTimer):
	timer_manager = timer

func setup_server():
	if not config.webhook_enabled:
		print("📡 Webhook Server deaktiviert")
		return

	http_server = TCPServer.new()

	# Server-Adresse bestimmen
	var bind_address = "127.0.0.1"  # Standard: nur localhost
	if config.webhook_bind_all_interfaces:
		bind_address = "*"  # Alle Interfaces

	var error = http_server.listen(config.webhook_port, bind_address)

	if error == OK:
		var local_ip = get_local_ip_address()

		print("✅ Webhook Server gestartet auf Port " + str(config.webhook_port))

		if config.webhook_bind_all_interfaces:
			print("🌐 Server lauscht auf ALLEN Netzwerk-Interfaces:")
			print("   • Localhost: http://127.0.0.1:" + str(config.webhook_port))
			if local_ip != "127.0.0.1" and local_ip != "":
				print("   • Netzwerk:  http://" + local_ip + ":" + str(config.webhook_port))
		else:
			print("🏠 Server lauscht nur auf Localhost:")
			print("   • Localhost: http://127.0.0.1:" + str(config.webhook_port))

		print("📡 Verfügbare Endpunkte:")
		print("   • UP:     /up")
		print("   • DOWN:   /down")
		print("   • STATUS: /status")
		print("   • GIFT:   /gift?level=X (X=1-12)")
		print("   • WEB UI: /interface")

	else:
		print("❌ Fehler beim Starten des Webhook Servers: " + str(error))

func process_requests():
	if not config.webhook_enabled or not http_server or not http_server.is_listening():
		return
		
	if http_server.is_connection_available():
		handle_request()

func handle_request():
	var client = http_server.take_connection()
	var request = client.get_string(client.get_available_bytes())
	
	var response = ""
	
	if request.begins_with("GET /up"):
		response = handle_up_request()
		webhook_up_received.emit()

	elif request.begins_with("GET /down"):
		response = handle_down_request()
		webhook_down_received.emit()

	elif request.begins_with("GET /status"):
		response = handle_status_request()
		webhook_status_requested.emit()

	elif request.begins_with("GET /gift"):
		response = handle_gift_request(request)

	elif request.begins_with("GET /interface"):
		response = handle_interface_request()

	else:
		response = handle_not_found()
	
	# Response senden
	client.put_data(response.to_utf8_buffer())
	client.disconnect_from_host()

func handle_up_request() -> String:
	if timer_manager and timer_manager.move_up():
		return create_http_response("200 OK", "Level UP erfolgreich!")
	else:
		return create_http_response("400 Bad Request", "Kann nicht höher gehen!")

func handle_down_request() -> String:
	if timer_manager and timer_manager.move_down():
		return create_http_response("200 OK", "Level DOWN erfolgreich!")
	else:
		return create_http_response("400 Bad Request", "Kann nicht tiefer gehen!")

func handle_status_request() -> String:
	if timer_manager:
		var status = timer_manager.get_status()
		return create_http_response("200 OK", JSON.stringify(status))
	else:
		return create_http_response("500 Internal Server Error", "Timer nicht verfügbar")

func handle_gift_request(request: String) -> String:
	if not timer_manager:
		return create_http_response("500 Internal Server Error", "Timer nicht verfügbar")

	# URL Parameter parsen
	var params = parse_url_parameters(request)

	if not params.has("level"):
		return create_http_response("400 Bad Request", "Parameter 'level' fehlt. Verwendung: /gift?level=X")

	var target_level = params["level"].to_int()

	# Level validieren (1-12)
	if target_level < 1 or target_level > 12:
		return create_http_response("400 Bad Request", "Level muss zwischen 1 und 12 liegen")

	var current_level = timer_manager.get_current_level() + 1  # Timer verwendet 0-basiert, wir 1-basiert
	var level_diff = target_level - current_level

	print("🎁 Gift Request: Aktuell Level " + str(current_level) + ", Ziel Level " + str(target_level) + ", Unterschied: " + str(level_diff))

	# Logik basierend auf Level-Unterschied
	if level_diff == 0:
		# Gleiches Level = Timer zurücksetzen
		timer_manager.restart_timer()
		webhook_gift_received.emit(target_level)
		return create_http_response("200 OK", "Timer für Level " + str(target_level) + " zurückgesetzt!")

	elif level_diff == 1:
		# Ein Level höher = Move Up
		if timer_manager.move_up():
			webhook_gift_received.emit(target_level)
			return create_http_response("200 OK", "Level erhöht auf " + str(target_level) + "!")
		else:
			return create_http_response("400 Bad Request", "Kann nicht auf Level " + str(target_level) + " erhöhen")

	elif level_diff == -1:
		# Ein Level tiefer = Move Down
		if timer_manager.move_down():
			webhook_gift_received.emit(target_level)
			return create_http_response("200 OK", "Level reduziert auf " + str(target_level) + "!")
		else:
			return create_http_response("400 Bad Request", "Kann nicht auf Level " + str(target_level) + " reduzieren")

	else:
		# Zu großer Unterschied = Ignorieren
		return create_http_response("400 Bad Request", "Level " + str(target_level) + " ist zu weit entfernt (aktuell: " + str(current_level) + "). Nur ±1 Level erlaubt.")

func handle_interface_request() -> String:
	var html = create_web_interface()
	return create_html_response("200 OK", html)

func handle_not_found() -> String:
	var help_text = {
		"error": "Endpunkt nicht gefunden",
		"available_endpoints": [
			"/up - Level erhöhen",
			"/down - Level verringern",
			"/status - Aktueller Status",
			"/gift?level=X - Geschenk für spezifisches Level",
			"/interface - Web-Interface"
		]
	}
	return create_http_response("404 Not Found", JSON.stringify(help_text))

func create_http_response(status: String, body: String) -> String:
	return "HTTP/1.1 " + status + "\r\n" + \
		   "Content-Type: application/json\r\n" + \
		   "Content-Length: " + str(body.length()) + "\r\n" + \
		   "Access-Control-Allow-Origin: *\r\n" + \
		   "Access-Control-Allow-Methods: GET, POST, OPTIONS\r\n" + \
		   "Access-Control-Allow-Headers: Content-Type\r\n" + \
		   "\r\n" + body

func create_html_response(status: String, html: String) -> String:
	return "HTTP/1.1 " + status + "\r\n" + \
		   "Content-Type: text/html; charset=utf-8\r\n" + \
		   "Content-Length: " + str(html.to_utf8_buffer().size()) + "\r\n" + \
		   "Access-Control-Allow-Origin: *\r\n" + \
		   "Access-Control-Allow-Methods: GET, POST, OPTIONS\r\n" + \
		   "Access-Control-Allow-Headers: Content-Type\r\n" + \
		   "\r\n" + html

func parse_url_parameters(request: String) -> Dictionary:
	var params = {}

	# Erste Zeile der HTTP-Request extrahieren (GET /path?param=value HTTP/1.1)
	var lines = request.split("\r\n")
	if lines.size() == 0:
		return params

	var request_line = lines[0]

	# URL aus der Request-Line extrahieren (zwischen GET und HTTP/1.1)
	var parts = request_line.split(" ")
	if parts.size() < 2:
		return params

	var url = parts[1]  # /gift?level=3&other=value

	# Prüfen ob Parameter vorhanden sind
	if "?" not in url:
		return params

	# Parameter-String extrahieren (alles nach dem ?)
	var param_string = url.split("?", false, 1)[1]

	# Einzelne Parameter aufteilen (durch & getrennt)
	var param_pairs = param_string.split("&")

	for pair in param_pairs:
		if "=" in pair:
			var key_value = pair.split("=", false, 1)
			if key_value.size() == 2:
				params[key_value[0]] = key_value[1]

	return params

func get_local_ip_address() -> String:
	# Versuche lokale IP-Adresse zu ermitteln
	var local_ip = ""

	# Godot 4 IP-Ermittlung über IP-Objekt
	var ip_list = IP.get_local_addresses()

	for ip in ip_list:
		# Filtere private Netzwerk-IPs (nicht 127.x.x.x und nicht IPv6)
		if ip != "127.0.0.1" and not ip.contains(":"):
			# Typische private Netzwerk-Bereiche bevorzugen
			if ip.begins_with("192.168.") or ip.begins_with("10.") or ip.begins_with("172."):
				local_ip = ip
				break

	# Fallback falls keine private IP gefunden
	if local_ip == "" and ip_list.size() > 0:
		for ip in ip_list:
			if ip != "127.0.0.1" and not ip.contains(":"):
				local_ip = ip
				break

	return local_ip

func create_web_interface() -> String:
	var current_level = 1
	var time_left = "0:00"
	var is_running = false

	if timer_manager:
		current_level = timer_manager.get_current_level() + 1
		time_left = config.format_time(timer_manager.get_time_left())
		is_running = timer_manager.is_timer_running()

	var local_ip = get_local_ip_address()
	var base_url_localhost = "http://127.0.0.1:" + str(config.webhook_port)
	var base_url_network = ""

	if config.webhook_bind_all_interfaces and local_ip != "" and local_ip != "127.0.0.1":
		base_url_network = "http://" + local_ip + ":" + str(config.webhook_port)

	var html = """<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>TikTok Ladder Overlay - Steuerung</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }

        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
            color: #333;
        }

        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 15px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
            overflow: hidden;
        }

        .header {
            background: linear-gradient(45deg, #ff6b6b, #feca57);
            color: white;
            padding: 30px;
            text-align: center;
        }

        .header h1 {
            font-size: 2.5em;
            margin-bottom: 10px;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
        }

        .status {
            background: #f8f9fa;
            padding: 25px;
            border-bottom: 3px solid #dee2e6;
        }

        .status-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 20px;
        }

        .status-card {
            background: white;
            padding: 20px;
            border-radius: 10px;
            text-align: center;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }

        .status-card h3 {
            color: #495057;
            margin-bottom: 10px;
        }

        .status-value {
            font-size: 1.8em;
            font-weight: bold;
            color: #007bff;
        }

        .controls {
            padding: 30px;
        }

        .control-section {
            margin-bottom: 40px;
        }

        .control-section h2 {
            color: #495057;
            margin-bottom: 20px;
            font-size: 1.5em;
            border-bottom: 2px solid #dee2e6;
            padding-bottom: 10px;
        }

        .button-group {
            display: flex;
            gap: 15px;
            flex-wrap: wrap;
            justify-content: center;
        }

        .btn {
            padding: 15px 30px;
            border: none;
            border-radius: 8px;
            font-size: 1.1em;
            font-weight: bold;
            cursor: pointer;
            transition: all 0.3s ease;
            text-transform: uppercase;
            letter-spacing: 1px;
            min-width: 150px;
        }

        .btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 12px rgba(0,0,0,0.2);
        }

        .btn-up {
            background: linear-gradient(45deg, #28a745, #20c997);
            color: white;
        }

        .btn-down {
            background: linear-gradient(45deg, #dc3545, #fd7e14);
            color: white;
        }

        .btn-reset {
            background: linear-gradient(45deg, #6f42c1, #e83e8c);
            color: white;
        }

        .documentation {
            background: #f8f9fa;
            padding: 30px;
        }

        .doc-section {
            background: white;
            margin-bottom: 25px;
            border-radius: 10px;
            padding: 25px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        .doc-section h3 {
            color: #495057;
            margin-bottom: 15px;
        }

        .endpoint {
            background: #f1f3f4;
            padding: 10px 15px;
            border-left: 4px solid #007bff;
            margin: 10px 0;
            font-family: monospace;
            font-size: 0.9em;
        }

        .endpoint.get { border-left-color: #28a745; }
        .endpoint.post { border-left-color: #ffc107; }

        .response-example {
            background: #2d3748;
            color: #e2e8f0;
            padding: 15px;
            border-radius: 5px;
            font-family: monospace;
            font-size: 0.85em;
            overflow-x: auto;
            margin: 10px 0;
        }

        .level-buttons {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(80px, 1fr));
            gap: 10px;
            margin-top: 20px;
        }

        .level-btn {
            padding: 10px;
            background: linear-gradient(45deg, #667eea, #764ba2);
            color: white;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-weight: bold;
        }

        .level-btn:hover {
            transform: scale(1.05);
        }

        .message {
            padding: 15px;
            margin: 15px 0;
            border-radius: 8px;
            display: none;
        }

        .message.success {
            background: #d4edda;
            color: #155724;
            border: 1px solid #c3e6cb;
        }

        .message.error {
            background: #f8d7da;
            color: #721c24;
            border: 1px solid #f5c6cb;
        }

        @media (max-width: 768px) {
            .button-group { flex-direction: column; }
            .btn { width: 100%; }
            .level-buttons { grid-template-columns: repeat(4, 1fr); }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎮 TikTok Ladder Overlay</h1>
            <p>Steuerung & Dokumentation</p>
        </div>

        <div class="status">
            <div class="status-grid">
                <div class="status-card">
                    <h3>Aktuelles Level</h3>
                    <div class="status-value" id="current-level">""" + str(current_level) + """KMH</div>
                </div>
                <div class="status-card">
                    <h3>Timer</h3>
                    <div class="status-value" id="timer">""" + time_left + """</div>
                </div>
                <div class="status-card">
                    <h3>Status</h3>
                    <div class="status-value" id="status">""" + ("Läuft" if is_running else "Gestoppt") + """</div>
                </div>
            </div>
            <div id="message" class="message"></div>
        </div>

        <div class="controls">
            <div class="control-section">
                <h2>🎯 Schnell-Steuerung</h2>
                <div class="button-group">
                    <button class="btn btn-up" onclick="sendCommand('up')">
                        🔥 Level Hoch
                    </button>
                    <button class="btn btn-down" onclick="sendCommand('down')">
                        📉 Level Runter
                    </button>
                    <button class="btn btn-reset" onclick="sendCommand('gift?level=""" + str(current_level) + """')">
                        ⏰ Timer Reset
                    </button>
                </div>
            </div>

            <div class="control-section">
                <h2>🎁 Geschenk-Level (Direkt)</h2>
                <p>Klicke auf ein Level um ein Geschenk für dieses Level zu simulieren:</p>
                <div class="level-buttons">"""

	# Level-Buttons generieren
	for i in range(1, 13):
		html += "<button class=\"level-btn\" onclick=\"sendCommand('gift?level=" + str(i) + "')\">" + str(i) + "KMH</button>"

	html += """
                </div>
            </div>
        </div>

        <div class="documentation">
            <div class="doc-section">
                <h3>📡 Webhook API Dokumentation</h3>
                <p><strong>Base URLs:</strong></p>
                <div class="endpoint">Localhost: """ + base_url_localhost + """</div>"""

	if base_url_network != "":
		html += """<div class="endpoint">Netzwerk: """ + base_url_network + """</div>"""

	html += """
            </div>

            <div class="doc-section">
                <h3>🔧 Verfügbare Endpunkte</h3>

                <h4>Level Steuerung</h4>
                <div class="endpoint get">GET /up</div>
                <p>Erhöht das Level um 1 (falls möglich)</p>

                <div class="endpoint get">GET /down</div>
                <p>Reduziert das Level um 1 (falls möglich)</p>

                <h4>Geschenk-System</h4>
                <div class="endpoint get">GET /gift?level=X</div>
                <p>Simuliert ein Geschenk für Level X (1-12)</p>
                <ul>
                    <li><strong>Gleiches Level:</strong> Timer wird zurückgesetzt</li>
                    <li><strong>+1 Level:</strong> Level wird erhöht</li>
                    <li><strong>-1 Level:</strong> Level wird reduziert</li>
                    <li><strong>>1 Level Unterschied:</strong> Wird ignoriert</li>
                </ul>

                <h4>Status & Interface</h4>
                <div class="endpoint get">GET /status</div>
                <p>Gibt aktuellen Status als JSON zurück</p>

                <div class="endpoint get">GET /interface</div>
                <p>Diese Web-Interface Seite</p>
            </div>

            <div class="doc-section">
                <h3>📝 Beispiele</h3>
                <p><strong>cURL Befehle:</strong></p>
                <div class="response-example">curl """ + base_url_localhost + """/up
curl """ + base_url_localhost + """/gift?level=5
curl """ + base_url_localhost + """/status</div>

                <p><strong>Browser Links:</strong></p>
                <div class="response-example"><a href="/up" target="_blank">""" + base_url_localhost + """/up</a>
<a href="/gift?level=3" target="_blank">""" + base_url_localhost + """/gift?level=3</a>
<a href="/status" target="_blank">""" + base_url_localhost + """/status</a></div>
            </div>

            <div class="doc-section">
                <h3>🔗 Integration mit TikFinity/TikTory</h3>
                <p>Verwende diese URLs als Webhooks in deinen Tools:</p>
                <div class="response-example">1KMH Geschenk: """ + (base_url_network if base_url_network != "" else base_url_localhost) + """/gift?level=1
2KMH Geschenk: """ + (base_url_network if base_url_network != "" else base_url_localhost) + """/gift?level=2
3KMH Geschenk: """ + (base_url_network if base_url_network != "" else base_url_localhost) + """/gift?level=3
...
12KMH Geschenk: """ + (base_url_network if base_url_network != "" else base_url_localhost) + """/gift?level=12</div>
            </div>
        </div>
    </div>

    <script>
        function sendCommand(endpoint) {
            fetch('/' + endpoint)
                .then(response => response.text())
                .then(data => {
                    showMessage('Befehl erfolgreich gesendet: ' + endpoint, 'success');
                    updateStatus();
                })
                .catch(error => {
                    showMessage('Fehler: ' + error, 'error');
                });
        }

        function updateStatus() {
            fetch('/status')
                .then(response => response.json())
                .then(data => {
                    document.getElementById('current-level').textContent = data.current_level + 'KMH';
                    document.getElementById('timer').textContent = formatTime(data.time_left);
                    document.getElementById('status').textContent = data.is_running ? 'Läuft' : 'Gestoppt';
                })
                .catch(error => console.error('Status Update Fehler:', error));
        }

        function showMessage(text, type) {
            const message = document.getElementById('message');
            message.textContent = text;
            message.className = 'message ' + type;
            message.style.display = 'block';
            setTimeout(() => {
                message.style.display = 'none';
            }, 3000);
        }

        function formatTime(seconds) {
            const mins = Math.floor(seconds / 60);
            const secs = Math.floor(seconds % 60);
            return mins + ':' + (secs < 10 ? '0' : '') + secs;
        }

        // Status alle 2 Sekunden aktualisieren
        setInterval(updateStatus, 2000);
    </script>
</body>
</html>"""

	return html

func shutdown():
	if http_server and http_server.is_listening():
		http_server.stop()
		print("📡 Webhook Server beendet")

# Test-Funktionen
func test_connection() -> bool:
	return http_server != null and http_server.is_listening()

func get_server_info() -> Dictionary:
	var info = {
		"enabled": config.webhook_enabled,
		"port": config.webhook_port,
		"running": test_connection(),
		"bind_all_interfaces": config.webhook_bind_all_interfaces,
		"endpoints": ["/up", "/down", "/status", "/gift?level=X", "/interface"]
	}

	if config.webhook_bind_all_interfaces:
		var local_ip = get_local_ip_address()
		info["localhost_url"] = "http://127.0.0.1:" + str(config.webhook_port)
		if local_ip != "" and local_ip != "127.0.0.1":
			info["network_url"] = "http://" + local_ip + ":" + str(config.webhook_port)
	else:
		info["localhost_url"] = "http://127.0.0.1:" + str(config.webhook_port)

	return info
