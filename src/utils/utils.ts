/**
 * Main utility file, any general purpose utility functions that doesn't need
 * a full file should be placed here.
 */
import type { Interaction } from 'discord.js';

export const userCombo = (interaction: Interaction) => `${interaction.user.tag} (${interaction.user.id})`;

export function debounce<T extends (...args: any[]) => any>(fn: T, delay: number): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      fn(...args);
    }, delay);
  };
}
