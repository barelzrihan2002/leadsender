import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
export function cn(...inputs) {
    return twMerge(clsx(inputs));
}
export function formatPhoneNumber(phone) {
    // Remove all non-digit characters
    const cleaned = phone.replace(/\D/g, '');
    // Format as international number if applicable
    if (cleaned.length >= 10) {
        return `+${cleaned}`;
    }
    return phone;
}
export function getRandomDelay(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}
export function replaceVariables(template, variables) {
    let result = template;
    Object.entries(variables).forEach(([key, value]) => {
        const regex = new RegExp(`{{${key}}}`, 'g');
        result = result.replace(regex, value);
    });
    return result;
}
