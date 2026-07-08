/**
 * Main utility file, any general purpose utility functions that doesn't need
 * a full file should be placed here.
 */
import type { Interaction } from 'discord.js';

import { AppLogger } from './logger';

export const userCombo = (interaction: Interaction) => `${interaction.user.tag} (${interaction.user.id})`;
export const baseLogger = new AppLogger('discord');
