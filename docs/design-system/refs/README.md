# Local photo refs

Open the file, then the source URL only if you need a larger crop. Mobbin screens: do not search Mobbin again for those four. Onyx marketing: [onyx.app](https://onyx.app/).

Chat rail is cloned from ChatGPT via [assistant-ui](https://www.assistant-ui.com/docs/ui/thread-list) (anatomy) and [Beautiful UI Sidebar Nav](https://www.beautifului.dev/) (hover pill, accent new). Destination groups stay Linear. Paper Drive from Figma Recents / Flodesk. Other Drive lists from Google Drive. Public landing from onyx.app. See [navigation.md](../../features/navigation.md) and [clone-sources.md](../clone-sources.md).

| File | Copy this | Source |
|---|---|---|
| [chatgpt-sidebar.jpg](chatgpt-sidebar.jpg) | Rail: New chat is a **row** (plus + word), not a boxed button. Destinations then thread list. No empty flex void. Account pinned at the bottom. | [Mobbin 7eb619eb](https://mobbin.com/screens/7eb619eb-3da0-47f8-a7a5-6061b1d6becb) |
| [chatgpt-sidebar-threads.jpg](chatgpt-sidebar-threads.jpg) | Thread titles truncate. Overflow actions are not a permanent 44px column. | [Mobbin 0ef9e024](https://mobbin.com/screens/0ef9e024-9a21-4d99-81b1-6908d486c2d2) |
| [linear-sidebar.jpg](linear-sidebar.jpg) | Places: small group labels, 16px icon + word, nested child indented as one row, active is surface fill not a side bar. Canvas behind the rail. | [Mobbin 815793b1](https://mobbin.com/screens/815793b1-5c75-43ac-94c7-93380781e337) |
| [linear-sidebar-issues.jpg](linear-sidebar-issues.jpg) | Same rail against a floating white panel. Item density ~32–40px visual, 40px desktop hit. | [Mobbin dba91946](https://mobbin.com/screens/dba91946-d147-4b2f-ad92-4195eae017fc) |
| [onyx-landing-hero.png](onyx-landing-hero.png) | Public `/`: sticky nav, huge centered promise, product composer in the hero, two doors, compact command bar, then how-it-works. Anatomy only. | [onyx.app](https://onyx.app/) |
| [onyx-hero-chat.png](onyx-hero-chat.png) | Hero composer: ~800×96, 16px radius, no border, blue glow, textarea then 32px toolbar (chip left, send right, send grey until there is text). | [onyx.app](https://onyx.app/) |

## Rail reading order (ours)

1. Mark + OpenPath  
2. New conversation (icon + word, same row as Coach)  
3. Coach (place)  
4. Prepare (Paper, Pitch)  
5. Opportunities (Search, Apply)  
6. History — collapsible, under Apply; the label stays when empty  
7. Account at the bottom edge  

Desktop: drag the trailing edge to resize (12–20rem). The phone drawer stays 16rem.
