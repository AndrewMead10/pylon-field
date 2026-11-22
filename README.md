# Pylon Field

A first-person fight at dusk under a dry lightning storm, drawn in pixel-art Gaussian splats.

You crest a hill and find two power pylons tearing a car apart on the road, inside a ring of others that still look like
ordinary pylons. They see you. You wake beside your own wreck with a rivet carbine, a pair of bolt cutters and not enough
rivets.

Play it at <https://game.amqm.dev>.

## Controls

| | |
| --- | --- |
| Mouse or arrow keys | Look |
| WASD | Move |
| Shift | Run |
| Space | Dodge |
| Click or F | Fire / cut |
| R | Reload |
| 1 / 2 / Q | Rivet carbine / bolt cutters / swap |
| Enter | Skip the opening |
| Esc | Pause |

Shoot the red lamps for the most damage. Legs can be shot off, or cut from underneath while a foot is planted. With the
cutters out, markers show every leg and sleeping pylon you could cut and light up when one is in reach. Cutting a sleeping
pylon down wakes its nearest neighbour.

## Layout

- `site/index.html` — the page: input, HUD, sound, and the hand-rasterised pixel art for the weapons and car interior.
- `site/pylon-field.js` — the scene and the whole simulation. It exposes `world.game`; the page only feeds input and reads events.
- `site/vendor/ink-studio/` — the parts of [Ink Studio](https://github.com/siliconjungle/shapeshift-labs-ink-studio)
  the game needs: the browser toolkit bundle (minified) and the WebGL renderer modules. MIT licensed; see the `LICENSE` beside them.

There is no build step.

## Run locally

```sh
python -m http.server 8080 --directory site
```

Then open <http://localhost:8080>.

## Deploy

The site is an assets-only Cloudflare Worker. `cloudflare.config.ts` names it and binds the custom domain.

```sh
cf deploy site
```
