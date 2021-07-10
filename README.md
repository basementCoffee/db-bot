# db-bot

<img align="right" src="assets/dbBotLogoBanner2.jpg" height=150>

A discord playback bot that saves your favorite links for you. Available for free.  

[Click here](https://discord.com/oauth2/authorize?client_id=730350452268597300&permissions=1076288&scope=bot) to add me.

## Commands

### Music/Audio
- `play [YouTube video URL]` - plays a YouTube link (accepts both youtube.com and youtu.be URLs)
- `play [YouTube playlist URL]` - plays a YouTube playlist in sequential order
- `play [Spotify URL]` - plays a Spotify track
- `play [YouTube playlist URL]` - plays a Spotify playlist in sequential order
- `play [search]` - plays the first YouTube link from a search query
- `pause` - pauses playback
- `resume` - resumes playback
- `skip` - skips to next song
- `skip [num]` - skips to next `num` song
- `rewind` - goes back one song
- `rewind [num]` - goes back `num` songs
- `loop` - loops the currently playing link on finish
- `stop` - stops playback and disconnects from the voice channel
- `lyrics` - looks for Genius lyrics of what is actively playing
- `queue` - lists the next 10 songs in the queue
- `now` - see what is currently playing (regenerates the embed)

### Server Keys
Users can save videos as key-words for easier playback.

- `add [key] [URL]` - creates a tag / key for the link and saves it to the server keys list
- `remove [key]` - removes a key from the server keys
- `keys` - view all of the keys for a server
- `d [key]` - plays the video associated with the key-word
- `dnow [key]` - plays the video immediately (is placed at the front of a queue)
- `rand [num]` - plays `num` random videos from server keys (`num` is optional)
- `search [word]` - searches the keys list for the word
- `link [key]` - retrieves the link for the `key`

### Personal Keys
These keys are tied to the user and not the server.

*Prepend  '`m`'  to the above commands (Server Keys) to access your **personal** keys list.*

*`ex: mkeys`*

### Other
- `dj` - enables dj mode, users must vote to advance, play, pause, and rewind tracks
- `dictator` - enables dictator mode, dictator controls all playback commands
- `verbose` - saves each link's embed in the active text channel
- `silence` - does not generate an embed for songs during a session
- `guess` - random roll for the number of people in the voice channel
- `guess [num]` - random number generator
- `changeprefix [new prefix]` - changes the prefix for all command (default is `.`)  

### Special
Type `congrats` or `congratulations` while in a voice channel to play a special congratulatory video.


## Invite - add to your server
[Click here](https://discord.com/oauth2/authorize?client_id=730350452268597300&permissions=1076288&scope=bot) 

