try:
    from serial.tools import list_ports
except ImportError:
    list_ports = None


def list_serial_ports() -> list[str]:
    if list_ports is None:
        raise RuntimeError("pyserial not installed. Run: pip install -r factory/requirements.txt")
    return sorted(p.device for p in list_ports.comports())


def choose_port(explicit: str | None) -> str:
    if explicit:
        return explicit
    ports = list_serial_ports()
    if not ports:
        raise SystemExit("no serial ports found")
    if len(ports) == 1:
        print(f"port: {ports[0]}")
        return ports[0]
    print("Available ports:")
    for i, port in enumerate(ports, 1):
        print(f"  {i}. {port}")
    while True:
        raw = input("Select port number: ").strip()
        if raw.isdigit():
            idx = int(raw) - 1
            if 0 <= idx < len(ports):
                return ports[idx]
        print("Invalid selection")
