import Cocoa
import Foundation

final class ExchangeApp: NSObject, NSApplicationDelegate {
    var window: NSWindow!
    var key = "", running = false, busy = false, starting = false
    var service: Process?
    var timer: Timer?
    var uk = false
    let root: URL = {
        if let configured = Bundle.main.object(forInfoDictionaryKey: "ZGProjectRoot") as? String, !configured.isEmpty {return URL(fileURLWithPath: configured, isDirectory: true)}
        return Bundle.main.bundleURL.deletingLastPathComponent()
    }()
    let titleLabel = NSTextField(labelWithString: "")
    let subtitle = NSTextField(wrappingLabelWithString: "")
    let state = NSTextField(labelWithString: "")
    let hint = NSTextField(wrappingLabelWithString: "")
    let backupInfo = NSTextField(wrappingLabelWithString: "")
    let start = NSButton(), backup = NSButton(), copyKey = NSButton(), stop = NSButton(), folder = NSButton()
    let console = NSTextView()
    var logScroll: NSScrollView!
    var consoleToggle = NSButton()
    func t(_ ru: String, _ ua: String) -> String { uk ? ua : ru }
    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.regular)
        let menu = NSMenu(), item = NSMenuItem(), appMenu = NSMenu();menu.addItem(item);item.submenu = appMenu;appMenu.addItem(withTitle:"Закрыть приложение / Закрити застосунок",action:#selector(NSApplication.terminate(_:)),keyEquivalent:"q");NSApp.mainMenu = menu
        window = NSWindow(contentRect: NSRect(x: 0,y: 0,width: 760,height: 620), styleMask: [.titled,.closable,.miniaturizable,.resizable], backing: .buffered, defer: false)
        window.title = "Zargota · " + t("Обмен эпизодами", "Обмін епізодами")
        window.minSize = NSSize(width: 640,height: 560)
        window.backgroundColor = NSColor(calibratedRed: 0.055,green: 0.10,blue: 0.08,alpha: 1)
        window.appearance = NSAppearance(named: .darkAqua)
        let main = NSStackView(); main.orientation = .vertical; main.alignment = .leading; main.spacing = 18
        main.translatesAutoresizingMaskIntoConstraints = false; window.contentView!.addSubview(main)
        NSLayoutConstraint.activate([main.leadingAnchor.constraint(equalTo: window.contentView!.leadingAnchor,constant: 30),main.trailingAnchor.constraint(equalTo: window.contentView!.trailingAnchor,constant: -30),main.topAnchor.constraint(equalTo: window.contentView!.topAnchor,constant: 26),main.bottomAnchor.constraint(equalTo: window.contentView!.bottomAnchor,constant: -24)])
        let lang = NSSegmentedControl(labels: ["RU","UK"], trackingMode: .selectOne, target: self, action: #selector(changeLanguage(_:)));lang.selectedSegment = 0
        let brand = NSTextField(labelWithString: "Z A R G O T A  ·  L O C A L");brand.textColor = .systemYellow;brand.font = .systemFont(ofSize: 11,weight: .medium)
        let header = NSStackView(views: [brand,NSView(),lang]);header.distribution = .fill;main.addArrangedSubview(header);header.widthAnchor.constraint(equalTo: main.widthAnchor).isActive = true
        titleLabel.font = .systemFont(ofSize: 30,weight: .semibold);titleLabel.textColor = NSColor(calibratedRed: 0.94,green: 0.85,blue: 0.64,alpha: 1)
        main.addArrangedSubview(titleLabel);subtitle.textColor = .secondaryLabelColor;main.addArrangedSubview(subtitle)
        state.font = .systemFont(ofSize: 21,weight: .semibold);main.addArrangedSubview(state);main.addArrangedSubview(hint)
        let buttons = NSStackView();buttons.spacing = 10
        for (button,action) in [(start,#selector(startService)),(backup,#selector(makeBackup)),(copyKey,#selector(copyToken)),(stop,#selector(stopService))] {button.bezelStyle = .rounded;button.target = self;button.action = action;if button !== copyKey {buttons.addArrangedSubview(button)}}
        start.contentTintColor = .systemYellow;main.addArrangedSubview(buttons)
        backupInfo.textColor = .secondaryLabelColor;main.addArrangedSubview(backupInfo)
        folder.bezelStyle = .rounded;folder.target = self;folder.action = #selector(openFolder);main.addArrangedSubview(folder)
        consoleToggle.bezelStyle = .rounded;consoleToggle.target = self;consoleToggle.action = #selector(toggleConsole);main.addArrangedSubview(consoleToggle)
        logScroll = NSScrollView();logScroll.hasVerticalScroller = true;logScroll.borderType = .bezelBorder;logScroll.translatesAutoresizingMaskIntoConstraints = false
        console.isEditable = false;console.isSelectable = true;console.font = .monospacedSystemFont(ofSize: 11,weight: .regular);console.backgroundColor = NSColor(calibratedWhite: 0.045,alpha: 1);console.textColor = .lightGray
        console.autoresizingMask = [.width];console.textContainer?.widthTracksTextView = true;console.isVerticallyResizable = true
        logScroll.documentView = console;main.addArrangedSubview(logScroll);logScroll.widthAnchor.constraint(equalTo: main.widthAnchor).isActive = true;logScroll.heightAnchor.constraint(greaterThanOrEqualToConstant: 130).isActive = true
        labels();window.center();window.makeKeyAndOrderFront(nil);NSApp.activate(ignoringOtherApps: true)
        log(t("Приложение открыто. Проверяю сервис.","Застосунок відкрито. Перевіряю сервіс."));poll()
        timer = Timer.scheduledTimer(withTimeInterval: 2,repeats: true) { [weak self] _ in self?.poll() }
    }
    func labels() {
        titleLabel.stringValue = t("Обмен эпизодами","Обмін епізодами")
        subtitle.stringValue = t("Редактор, резервные копии и связь с помощником — в одном окне.","Редактор, резервні копії та зв’язок із помічником — в одному вікні.")
        start.title = t("Подключиться","Підключитися");backup.title = t("Создать резерв","Створити резерв");copyKey.title = t("Ключ подключения","Ключ підключення");stop.title = t("Отключиться","Відключитися");folder.title = t("Открыть папку резервов","Відкрити папку резервів");consoleToggle.title = logScroll.isHidden ? t("▸ Показать консоль","▸ Показати консоль") : t("▾ Скрыть консоль","▾ Сховати консоль")
    }
    @objc func changeLanguage(_ sender: NSSegmentedControl) { uk = sender.selectedSegment == 1;labels();poll() }
    @objc func toggleConsole() { logScroll.isHidden.toggle();labels() }
    func log(_ message: String) {let f = DateFormatter();f.timeStyle = .medium;console.string += "[\(f.string(from: Date()))] \(message)\n";console.scrollToEndOfDocument(nil)}
    func readBackup() -> [String:Any]? {guard let data = try? Data(contentsOf: root.appendingPathComponent(".story-exchange/last-backup.json")) else {return nil};return (try? JSONSerialization.jsonObject(with:data)) as? [String:Any]}
    func localTime(_ value: String) -> String {let parser = ISO8601DateFormatter();parser.formatOptions = [.withInternetDateTime,.withFractionalSeconds];guard let date = parser.date(from:value) else {return value};let f = DateFormatter();f.locale = Locale(identifier:uk ? "uk_UA" : "ru_RU");f.dateStyle = .short;f.timeStyle = .short;return f.string(from:date)}
    func loadKey() { if let data = try? Data(contentsOf: root.appendingPathComponent(".story-exchange/connection.json")),let doc = try? JSONSerialization.jsonObject(with: data) as? [String:Any],let token = doc["token"] as? String {key = token} }
    func post(_ route: String, _ body: [String:Any] = [:], completion: @escaping ([String:Any]?) -> Void) {
        loadKey();guard !key.isEmpty else {completion(nil);return}
        var request = URLRequest(url: URL(string: "http://127.0.0.1:17349" + route)!);request.httpMethod = "POST";request.timeoutInterval = 4;request.setValue("Bearer " + key, forHTTPHeaderField: "Authorization");request.setValue("application/json",forHTTPHeaderField: "Content-Type");request.httpBody = try? JSONSerialization.data(withJSONObject: body)
        URLSession.shared.dataTask(with: request) {data,response,error in
            let value = data.flatMap {try? JSONSerialization.jsonObject(with: $0) as? [String:Any]}
            DispatchQueue.main.async {completion(value)}
        }.resume()
    }
    func poll() {post("/status") { [weak self] info in
        guard let self = self else {return};self.running = info?["connected"] != nil
        let connected = info?["connected"] as? Bool ?? false, pending = info?["pending"] as? Bool ?? false
        self.start.isEnabled = !self.running && !self.starting;self.stop.isEnabled = self.running && !pending && !self.busy;self.backup.isEnabled = connected && !pending && !self.busy;self.copyKey.isEnabled = self.running
        self.state.textColor = connected ? .systemGreen : self.running ? .systemYellow : .secondaryLabelColor
        self.state.stringValue = connected ? self.t("● Всё готово","● Усе готово") : self.running ? self.t("● Сервис работает · подключи редактор","● Сервіс працює · підключи редактор") : self.t("● Обмен выключен","● Обмін вимкнено")
        self.hint.stringValue = connected ? self.t("Можно работать как обычно. Резерв не меняет эпизоды.","Можна працювати як завжди. Резерв не змінює епізоди.") : self.running ? self.t("Открой редактор Зарготы. Он подключится автоматически — код вводить не нужно.","Відкрий редактор Зарготи. Він підключиться автоматично — код вводити не потрібно.") : self.t("Нажми «Подключиться». Редактор подключится сам.","Натисни «Підключитися». Редактор підключиться сам.")
        if let b = (info?["lastBackup"] as? [String:Any]) ?? self.readBackup() {self.backupInfo.stringValue = self.t("Последний резерв: ","Останній резерв: ") + self.localTime(b["time"] as? String ?? "") + " · " + String(b["count"] as? Int ?? 0)} else {self.backupInfo.stringValue = self.t("Здесь ещё не создавали резерв. Ранее сохранённые копии остаются в проекте.","Тут ще не створювали резерв. Раніше збережені копії залишаються у проєкті.")}
    } }
    @objc func startService() {
        guard !starting else {return}
        guard FileManager.default.fileExists(atPath: root.appendingPathComponent("scripts/story-exchange.cjs").path) else {log(t("Папка проекта не найдена: ","Папку проєкту не знайдено: ")+root.path);return}
        starting = true;start.isEnabled = false
        let candidates = [NSHomeDirectory()+"/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node","/opt/homebrew/bin/node","/usr/local/bin/node"]
        guard let node = candidates.first(where: {FileManager.default.isExecutableFile(atPath: $0)}) else {log(t("Node.js не найден.","Node.js не знайдено."));starting = false;return}
        let p = Process();p.executableURL = URL(fileURLWithPath: node);p.arguments = [root.appendingPathComponent("scripts/story-exchange.cjs").path,"serve"];p.currentDirectoryURL = root
        let pipe = Pipe();p.standardOutput = pipe;p.standardError = pipe
        pipe.fileHandleForReading.readabilityHandler = { [weak self] handle in let data = handle.availableData;if data.isEmpty {handle.readabilityHandler = nil;return};let text = String(data:data,encoding:.utf8) ?? "";DispatchQueue.main.async {self?.log(text.trimmingCharacters(in:.whitespacesAndNewlines))} }
        p.terminationHandler = { [weak self] _ in DispatchQueue.main.async {self?.starting = false;self?.poll()} }
        do {try p.run();service = p;log(t("Запускаю локальный сервис…","Запускаю локальний сервіс…"));DispatchQueue.main.asyncAfter(deadline:.now()+1) {self.starting = false;self.poll()}} catch {starting = false;log(error.localizedDescription)}
    }
    @objc func stopService() {post("/shutdown") {result in self.log(result?["ok"] as? Bool == true ? self.t("Сервис остановлен.","Сервіс зупинено.") : self.t("Остановка не подтверждена: возможно, выполняется команда.","Зупинку не підтверджено: можливо, виконується команда."));self.poll()} }
    @objc func copyToken() {loadKey();NSPasteboard.general.clearContents();NSPasteboard.general.setString(key,forType:.string);log(t("Ключ скопирован. Вставь его в «Прямые правки → Обмен через папку».","Ключ скопійовано. Встав його у «Прямі правки → Обмін через папку»."))}
    @objc func openFolder() {let url = root.appendingPathComponent(".story-exchange/backups");try? FileManager.default.createDirectory(at:url,withIntermediateDirectories:true);NSWorkspace.shared.open(url)}
    @objc func makeBackup() {guard !busy else {return};busy = true;backup.isEnabled = false;log(t("Создаю резерв всех эпизодов…","Створюю резерв усіх епізодів…"));post("/command",["op":"backup"]) {result in guard let id = result?["id"] as? String else {self.busy = false;self.log(self.t("Не удалось начать резервирование.","Не вдалося почати резервування."));return};self.waitBackup(id,60)} }
    func waitBackup(_ id: String,_ remaining: Int) {post("/job",["id":id]) {job in
        if job?["state"] as? String == "done" {self.busy = false;let result = job?["result"] as? [String:Any];self.log(result?["ok"] as? Bool == true ? self.t("Резерв сохранён. Эпизоды не изменены.","Резерв збережено. Епізоди не змінено.") : self.t("Резерв не создан: ","Резерв не створено: ")+(result?["error"] as? String ?? "error"));self.poll();return}
        guard remaining>0 else {self.busy = false;self.log(self.t("Нет подтверждения. Не отправляй команду повторно; проверь связь.","Немає підтвердження. Не надсилай команду повторно; перевір зв’язок."));return}
        DispatchQueue.main.asyncAfter(deadline:.now()+1) {self.waitBackup(id,remaining-1)}
    } }
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {false}
    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {window.makeKeyAndOrderFront(nil);NSApp.activate(ignoringOtherApps:true);return true}
}
let app = NSApplication.shared
let delegate = ExchangeApp()
app.delegate = delegate
app.run()
