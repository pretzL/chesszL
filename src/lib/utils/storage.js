import { browser } from "$app/environment";

export const storage = {
    get: (key, defaultValue = null) => {
        if (!browser) return defaultValue;

        const item = localStorage.getItem(key);
        if (item === null) return defaultValue;

        try {
            if (item[0] === "{" || item[0] === "[") {
                return JSON.parse(item);
            }

            return item;
        } catch {
            return defaultValue;
        }
    },

    set: (key, value) => {
        if (!browser) return;

        try {
            if (typeof value === "object") {
                localStorage.setItem(key, JSON.stringify(value));
            } else {
                localStorage.setItem(key, value);
            }
        } catch (e) {
            console.error("Error saving to localStorage:", e);
        }
    },

    remove: (key) => {
        if (browser) {
            localStorage.removeItem(key);
        }
    },
};
