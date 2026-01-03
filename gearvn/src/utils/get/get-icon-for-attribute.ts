export const getIconForAttribute = (fieldName: string) => {
  switch (fieldName.toLowerCase()) {
    case "brand":
      return "mdi:tag-outline";

    case "color":
      return "mdi:palette";

    case "usage":
      return "streamline-sharp:ai-gaming-robot";

    case "type":
      return "mdi:shape";

    case "connection":
    case "bluetooth":
      return "mdi:bluetooth";

    case "led":
      return "mdi:led-on";

    case "size":
    case "screensize":
      return "mdi:monitor-cellphone";

    case "screentype":
      return "mdi:television-play";

    case "height":
      return "mdi:ruler";

    case "weight":
      return "mdi:weight-kilogram";

    case "wattage":
      return "mdi:flash";

    case "standard":
      return "mdi:power-plug";

    case "captype":
      return "mdi:power-plug-outline";

    case "bus":
      return "mdi:transmission-tower";

    case "capacity":
      return "mdi:memory";

    case "ssd":
      return "mdi:harddisk";

    case "cpu":
      return "mdi:cpu-32-bit";

    case "ram":
      return "mdi:memory";

    case "ramtype":
      return "mdi:chip";

    case "vga":
      return "mdi:video";

    case "chipset":
      return "mdi:chip";

    case "socket":
      return "mdi:power-plug";

    case "panel":
      return "mdi:monitor";

    case "refreshrate":
      return "mdi:refresh-auto";

    case "resolution":
      return "mdi:aspect-ratio";

    case "supportedmainboard":
      return "mdi:server";

    case "fansinclude":
      return "mdi:fan";

    case "keycap":
      return "mdi:keyboard";

    case "port":
      return "mdi:usb-port";

    case "battery":
      return "mdi:battery";

    case "material":
      return "mdi:layers";

    default:
      return "mdi:information-outline";
  }
};
