export const getIconForCategory = (name: string) => {
  switch (name.toLowerCase()) {
    case "monitor":
      return "ic:round-monitor";
    case "pc":
      return "streamline:computer-pc-desktop";
    case "laptop":
      return "mdi:laptop";
    case "mainboard":
      return "si:memory-line";
    case "headphone":
      return "cuida:headphone-outline";
    case "chair":
      return "hugeicons:office-chair";
    case "mouse":
      return "ic:outline-mouse";
    case "ram":
      return "ri:ram-line";
    case "storage":
      return "bx:hdd";
    case "cooler":
      return "ph:fan";
    case "keyboard":
      return "ic:outline-keyboard";
    case "psu":
      return "ic:outline-power";
    case "case":
      return "lucide:pc-case";
    case "speaker":
      return "ic:outline-speaker";
    case "powerbank":
      return "gg:battery";
    case "accessory":
      return "mynaui:gift";
    default:
      return "mdi:tag";
  }
};
