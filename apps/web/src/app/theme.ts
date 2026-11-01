import { definePreset } from '@primeuix/themes';
import Aura from '@primeuix/themes/aura';

/**
 * Aura's default primary color is emerald 500, where white text has a contrast of only 2.53:1.
 * Emerald 700 and darker meet the 4.5:1 that WCAG AA requires (XC-017).
 */
export const GamingaloTheme = definePreset(Aura, {
  semantic: {
    colorScheme: {
      light: {
        primary: {
          color: '{primary.700}',
          contrastColor: '#ffffff',
          hoverColor: '{primary.800}',
          activeColor: '{primary.900}',
        },
      },
    },
  },
});
