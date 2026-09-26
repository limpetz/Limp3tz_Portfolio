# Lightweight arcade collectibles

- coin.svg: crisp 24x24 gold pixel coin, using the site's #ffd23f / #5a3d00 palette.
- heart.svg: crisp 24x24 neon pink heart.
- collectibles.css: CSS-only coin spin and heart glow; no JavaScript or animation library.

Load the stylesheet once. Add the matching icon inside each existing pickup button, keeping your current accessible labels and collection handlers:

    <button type="button" title="Collect Coin (+100 pts)" aria-label="Collect Coin">
      <img class="collectible-icon collectible-icon--coin" src="/assets/coin.svg" alt="">
    </button>

    <button type="button" title="Restore health" aria-label="Collect Heart">
      <img class="collectible-icon collectible-icon--heart" src="/assets/heart.svg" alt="">
    </button>

The CSS expects each image to fill the existing 20x20 button. Use a transparent button background for the glowing heart. Both SVGs have transparent backgrounds. The CSS respects the operating system's reduced-motion setting.
