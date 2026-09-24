# Street v2 — generation record

Built-in image generation; originals preserved. Map 1672×941; pedestrian man 1274×1234; pedestrian woman 1269×1240; cart 1536×1024. Three moving sprites have alpha channels; cart background samples have alpha=0.

## Map

Use case: illustration-story. New fantasy RPG walkable neighborhood map, same warm painterly stone and timber architecture as reference, Dorogograd. Wide 16:9 high oblique overhead camera, no horizon. Broad straight cobblestone ROAD runs horizontally across lower middle from left edge to right edge at about 65 percent height, clear for horse carts traveling left/right. A spacious pedestrian pavement immediately above road. TWO modest storefronts along upper left and upper center: family food shop cream awning and bread baskets, adjoining small pottery shop blue awning and ceramic pots. At upper RIGHT beyond shops, a small green courtyard with lawn, low bushes, shade tree on far boundary, bench and little clear chalk game circle, connected by wide stone path from road. Keep road and walks very clear; building roofs limited to upper edge, greenery does not hide walkable path. Prosperous ordinary merchant district, not palace. Late morning sun. Environment ONLY, no people, no animals, no vehicles, no text, no UI, no frame. Consistent scale for separate moving pedestrian and cart sprites.

## pedestrian-man-v1

Use case: illustration-story. A single isolated game map sprite on genuinely TRANSPARENT alpha background, no ground plane, no scenery, no text, no border, no circle. One ordinary adult male medieval townsman in brown vest green shirt carrying small shoulder satchel, full body walking to screen RIGHT, natural stride. Painterly warm semi-realistic fantasy style matching Dorogograd stone-and-timber map. Elevated 55-degree oblique camera looking down, compatible with high-oblique RPG map, not eye-level portrait. Object fully inside canvas with modest transparent margin, clean edges. No baked checkerboard. Horizontal landscape canvas for cart; tightly framed square for person.

## pedestrian-woman-v1

Use case: illustration-story. A single isolated game map sprite on genuinely TRANSPARENT alpha background, no ground plane, no scenery, no text, no border, no circle. One ordinary adult woman medieval townswoman in muted blue dress and cream apron carrying basket, full body walking to screen RIGHT, natural stride. Painterly warm semi-realistic fantasy style matching Dorogograd stone-and-timber map. Elevated 55-degree oblique camera looking down, compatible with high-oblique RPG map, not eye-level portrait. Object fully inside canvas with modest transparent margin, clean edges. No baked checkerboard. Horizontal landscape canvas for cart; tightly framed square for person.

## horse-cart-v1

Use case: illustration-story. A single isolated game map sprite on genuinely TRANSPARENT alpha background, no ground plane, no scenery, no text, no border, no circle. One complete modest wooden four-wheel merchant cart pulled by one chestnut horse, with seated clothed driver and two covered sacks, whole horse harness wheels and cart visible, traveling towards screen RIGHT. Side view from high overhead oblique camera, horse at RIGHT and cart at LEFT. No other people. Painterly warm semi-realistic fantasy style matching Dorogograd stone-and-timber map. Elevated 55-degree oblique camera looking down, compatible with high-oblique RPG map, not eye-level portrait. Object fully inside canvas with modest transparent margin, clean edges. No baked checkerboard. Horizontal landscape canvas for cart; tightly framed square for person.

## Cart alpha refinement

Use case: background-extraction. Edit this exact horse and cart. Remove ALL brown and black background haze, glow and shadows outside the silhouette. Keep horse, cart, driver, harness, bags exactly unchanged in pose colors identity size and perspective. All pixels outside the actual object must be fully transparent alpha, including between legs and spokes. Clean transparent game sprite, no replacement backdrop, no ground shadow, no vignette, no glow.
