import strawberry from "./icons/device-strawberry.png";
import herb from "./icons/device-herb.png";
import sprout from "./icons/device-sprout.png";
import sunflower from "./icons/device-sunflower.png";
import tomato from "./icons/device-tomato.png";
import lettuce from "./icons/device-lettuce.png";
import pepper from "./icons/device-pepper.png";
import flower from "./icons/device-flower.png";

// Keep this order: existing devices store the icon's index in localStorage.
export const DEVICE_ICONS = [
    { src: strawberry, label: "딸기" },
    { src: herb, label: "허브" },
    { src: sprout, label: "새싹" },
    { src: sunflower, label: "해바라기" },
    { src: tomato, label: "토마토" },
    { src: lettuce, label: "상추" },
    { src: pepper, label: "고추" },
    { src: flower, label: "꽃" },
];

export const DEFAULT_DEVICE_ICON = DEVICE_ICONS[2];