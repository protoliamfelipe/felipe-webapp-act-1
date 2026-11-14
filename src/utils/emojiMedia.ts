import { CustomEmoji } from '../types';

export interface EmojiEntry {
  char: string;
  name: string;
}

export interface EmojiCategory {
  id: string;
  label: string;
  icon: string;
  emojis: EmojiEntry[];
}

const RECENT_EMOJIS_KEY = 'pilgrim_recent_emojis_v1';

// Comprehensive Unicode emoji catalog covering all standard emoji categories
export const EMOJI_CATEGORIES: EmojiCategory[] = [
  {
    id: 'smileys',
    label: 'Smileys & Emotion',
    icon: '😀',
    emojis: [
      { char: '😀', name: 'grinning face happy smile' },
      { char: '😃', name: 'grinning big eyes happy' },
      { char: '😄', name: 'grinning smiling eyes laugh' },
      { char: '😁', name: 'beaming grin teeth' },
      { char: '😆', name: 'squinting laugh lol' },
      { char: '😅', name: 'sweat smile nervous' },
      { char: '🤣', name: 'rofl rolling laughing' },
      { char: '😂', name: 'joy tears laughing crying' },
      { char: '🙂', name: 'slightly smiling face' },
      { char: '🙃', name: 'upside down face' },
      { char: '🫠', name: 'melting face' },
      { char: '😉', name: 'wink winking face' },
      { char: '😊', name: 'blush smiling eyes warm' },
      { char: '😇', name: 'angel halo innocent' },
      { char: '🥰', name: 'smiling hearts love adore' },
      { char: '😍', name: 'heart eyes love crush' },
      { char: '🤩', name: 'star struck excited hype' },
      { char: '😘', name: 'kiss blowing heart' },
      { char: '😗', name: 'kissing face' },
      { char: '😚', name: 'kissing closed eyes' },
      { char: '😙', name: 'kissing smiling eyes' },
      { char: '🥲', name: 'smiling tear bittersweet' },
      { char: '😋', name: 'yum delicious tongue' },
      { char: '😛', name: 'tongue out playful' },
      { char: '😜', name: 'winking tongue silly' },
      { char: '🤪', name: 'zany crazy goofy' },
      { char: '😝', name: 'squinting tongue' },
      { char: '🤑', name: 'money mouth rich cash' },
      { char: '🤗', name: 'hugging hug warm' },
      { char: '🤭', name: 'hand over mouth giggle oops' },
      { char: '🫢', name: 'open eyes hand over mouth gasp' },
      { char: '🫣', name: 'peeking eye shy' },
      { char: '🤫', name: 'shushing quiet secret' },
      { char: '🤔', name: 'thinking hmm ponder' },
      { char: '🫡', name: 'saluting salute respect' },
      { char: '🤐', name: 'zipper mouth silent' },
      { char: '🤨', name: 'raised eyebrow sus doubt' },
      { char: '😐', name: 'neutral face meh' },
      { char: '😑', name: 'expressionless blank' },
      { char: '😶', name: 'no mouth speechless' },
      { char: '🫥', name: 'dotted line invisible' },
      { char: '😏', name: 'smirk smug sly' },
      { char: '😒', name: 'unamused side eye' },
      { char: '🙄', name: 'eye roll whatever' },
      { char: '😬', name: 'grimace awkward yikes' },
      { char: '😮‍💨', name: 'exhaling sigh relief' },
      { char: '🤥', name: 'lying pinocchio' },
      { char: '😌', name: 'relieved calm peaceful' },
      { char: '😔', name: 'pensive sad down' },
      { char: '😪', name: 'sleepy tired' },
      { char: '🤤', name: 'drooling hungry' },
      { char: '😴', name: 'sleeping zzz tired' },
      { char: '😷', name: 'mask sick' },
      { char: '🤒', name: 'thermometer fever sick' },
      { char: '🤕', name: 'bandage hurt' },
      { char: '🤢', name: 'nauseated sick green' },
      { char: '🤮', name: 'vomiting puke' },
      { char: '🤧', name: 'sneezing achoo' },
      { char: '🥵', name: 'hot sweating heat' },
      { char: '🥶', name: 'cold freezing ice' },
      { char: '🥴', name: 'woozy dizzy drunk' },
      { char: '😵', name: 'dizzy knocked out' },
      { char: '😵‍💫', name: 'spiral eyes confused' },
      { char: '🤯', name: 'exploding head mind blown' },
      { char: '🤠', name: 'cowboy hat yeehaw' },
      { char: '🥳', name: 'partying celebrate birthday' },
      { char: '🥸', name: 'disguised glasses mustache' },
      { char: '😎', name: 'sunglasses cool shades' },
      { char: '🤓', name: 'nerd glasses geek' },
      { char: '🧐', name: 'monocle inspect classy' },
      { char: '😕', name: 'confused' },
      { char: '🫤', name: 'diagonal mouth unsure' },
      { char: '😟', name: 'worried concerned' },
      { char: '🙁', name: 'slightly frowning sad' },
      { char: '☹️', name: 'frowning sad' },
      { char: '😮', name: 'open mouth wow surprised' },
      { char: '😯', name: 'hushed shocked' },
      { char: '😲', name: 'astonished amazed' },
      { char: '😳', name: 'flushed embarrassed' },
      { char: '🥺', name: 'pleading puppy eyes' },
      { char: '🥹', name: 'holding back tears' },
      { char: '😦', name: 'frowning open mouth' },
      { char: '😧', name: 'anguished' },
      { char: '😨', name: 'fearful scared' },
      { char: '😰', name: 'anxious sweat' },
      { char: '😥', name: 'sad relieved' },
      { char: '😢', name: 'crying tear sad' },
      { char: '😭', name: 'loudly crying sobbing' },
      { char: '😱', name: 'screaming shock omg' },
      { char: '😖', name: 'confounded frustrated' },
      { char: '😣', name: 'persevering struggle' },
      { char: '😞', name: 'disappointed' },
      { char: '😓', name: 'downcast sweat' },
      { char: '😩', name: 'weary exhausted' },
      { char: '😫', name: 'tired frustrated' },
      { char: '🥱', name: 'yawning sleepy bored' },
      { char: '😤', name: 'triumph steam angry' },
      { char: '😡', name: 'pouting rage mad angry' },
      { char: '😠', name: 'angry mad grumpy' },
      { char: '🤬', name: 'cursing swearing rage' },
      { char: '😈', name: 'smiling devil horns' },
      { char: '👿', name: 'angry devil imp' },
      { char: '💀', name: 'skull dead lmao' },
      { char: '☠️', name: 'skull crossbones pirate' },
      { char: '💩', name: 'poop' },
      { char: '🤡', name: 'clown circus' },
      { char: '👹', name: 'ogre oni mask' },
      { char: '👺', name: 'goblin tengu' },
      { char: '👻', name: 'ghost boo spooky' },
      { char: '👽', name: 'alien ufo' },
      { char: '👾', name: 'alien monster arcade game' },
      { char: '🤖', name: 'robot bot ai' },
      { char: '😺', name: 'grinning cat' },
      { char: '😸', name: 'grinning cat smiling eyes' },
      { char: '😹', name: 'joy cat tears' },
      { char: '😻', name: 'heart eyes cat' },
      { char: '😼', name: 'wry smile cat' },
      { char: '😽', name: 'kissing cat' },
      { char: '🙀', name: 'weary shocked cat' },
      { char: '😿', name: 'crying cat' },
      { char: '😾', name: 'pouting angry cat' },
      { char: '❤️', name: 'red heart love' },
      { char: '🧡', name: 'orange heart' },
      { char: '💛', name: 'yellow heart' },
      { char: '💚', name: 'green heart' },
      { char: '💙', name: 'blue heart' },
      { char: '💜', name: 'purple heart' },
      { char: '🖤', name: 'black heart' },
      { char: '🤍', name: 'white heart' },
      { char: '🤎', name: 'brown heart' },
      { char: '💔', name: 'broken heart' },
      { char: '❤️‍🔥', name: 'heart on fire passion' },
      { char: '💕', name: 'two hearts' },
      { char: '💖', name: 'sparkling heart' },
      { char: '💗', name: 'growing heart' },
      { char: '💘', name: 'cupid arrow heart' },
      { char: '💯', name: '100 hundred perfect score' },
      { char: '💢', name: 'anger symbol' },
      { char: '💥', name: 'boom collision explosion' },
      { char: '💫', name: 'dizzy star' },
      { char: '💦', name: 'sweat droplets water' },
      { char: '💨', name: 'dashing wind fast' },
      { char: '💬', name: 'speech balloon chat' },
      { char: '💤', name: 'zzz sleep' },
    ],
  },
  {
    id: 'people',
    label: 'People & Gestures',
    icon: '👍',
    emojis: [
      { char: '👋', name: 'wave hello hi bye' },
      { char: '🤚', name: 'raised back hand' },
      { char: '🖐️', name: 'hand splayed high five' },
      { char: '✋', name: 'raised hand stop' },
      { char: '🖖', name: 'vulcan salute' },
      { char: '🫱', name: 'rightwards hand' },
      { char: '🫲', name: 'leftwards hand' },
      { char: '👌', name: 'ok hand perfect' },
      { char: '🤌', name: 'pinched fingers italian' },
      { char: '🤏', name: 'pinching tiny small' },
      { char: '✌️', name: 'victory peace two' },
      { char: '🤞', name: 'crossed fingers luck' },
      { char: '🫰', name: 'finger heart snap' },
      { char: '🤟', name: 'love you gesture' },
      { char: '🤘', name: 'rock on horns metal' },
      { char: '🤙', name: 'call me shaka' },
      { char: '👈', name: 'point left' },
      { char: '👉', name: 'point right' },
      { char: '👆', name: 'point up' },
      { char: '👇', name: 'point down' },
      { char: '☝️', name: 'index up' },
      { char: '👍', name: 'thumbs up like yes good gg' },
      { char: '👎', name: 'thumbs down dislike no bad' },
      { char: '✊', name: 'raised fist solidarity' },
      { char: '👊', name: 'fist bump punch' },
      { char: '🤛', name: 'left fist' },
      { char: '🤜', name: 'right fist' },
      { char: '👏', name: 'clap applause bravo' },
      { char: '🙌', name: 'raising hands celebrate hype' },
      { char: '🫶', name: 'heart hands love' },
      { char: '👐', name: 'open hands' },
      { char: '🤲', name: 'palms up together' },
      { char: '🤝', name: 'handshake deal agree' },
      { char: '🙏', name: 'folded hands please pray thanks' },
      { char: '✍️', name: 'writing hand' },
      { char: '💅', name: 'nail polish slay' },
      { char: '💪', name: 'flex muscle strong gym' },
      { char: '🧠', name: 'brain smart iq' },
      { char: '👀', name: 'eyes look watching' },
      { char: '👁️', name: 'eye' },
      { char: '👂', name: 'ear listen' },
      { char: '👃', name: 'nose' },
      { char: '🗣️', name: 'speaking voice talk' },
      { char: '👤', name: 'silhouette user profile' },
      { char: '👥', name: 'users group people' },
      { char: '🫂', name: 'people hugging' },
      { char: '💃', name: 'woman dancing party' },
      { char: '🕺', name: 'man dancing party' },
      { char: '🏃', name: 'running sprint' },
      { char: '🙇', name: 'bowing sorry respect' },
      { char: '💁', name: 'tipping hand' },
      { char: '🙅', name: 'no gesture' },
      { char: '🙆', name: 'ok gesture' },
      { char: '🙋', name: 'raising hand question' },
      { char: '🤦', name: 'facepalm duh' },
      { char: '🤷', name: 'shrug idk whatever' },
      { char: '🧑‍💻', name: 'technologist coder dev' },
      { char: '🧑‍🎤', name: 'singer rockstar' },
      { char: '🥷', name: 'ninja stealth' },
      { char: '👑', name: 'crown king queen royalty' },
    ],
  },
  {
    id: 'animals',
    label: 'Animals & Nature',
    icon: '🦊',
    emojis: [
      { char: '🐶', name: 'dog puppy woof' },
      { char: '🐱', name: 'cat kitty meow' },
      { char: '🐭', name: 'mouse' },
      { char: '🐹', name: 'hamster' },
      { char: '🐰', name: 'rabbit bunny' },
      { char: '🦊', name: 'fox kitsune' },
      { char: '🐻', name: 'bear' },
      { char: '🐼', name: 'panda' },
      { char: '🐻‍❄️', name: 'polar bear' },
      { char: '🐨', name: 'koala' },
      { char: '🐯', name: 'tiger' },
      { char: '🦁', name: 'lion' },
      { char: '🐮', name: 'cow' },
      { char: '🐷', name: 'pig' },
      { char: '🐸', name: 'frog pepe ribbit' },
      { char: '🐵', name: 'monkey' },
      { char: '🙈', name: 'see no evil monkey' },
      { char: '🙉', name: 'hear no evil monkey' },
      { char: '🙊', name: 'speak no evil monkey' },
      { char: '🐔', name: 'chicken' },
      { char: '🐧', name: 'penguin' },
      { char: '🐦', name: 'bird' },
      { char: '🐤', name: 'chick' },
      { char: '🦆', name: 'duck' },
      { char: '🦅', name: 'eagle' },
      { char: '🦉', name: 'owl' },
      { char: '🦇', name: 'bat' },
      { char: '🐺', name: 'wolf' },
      { char: '🐗', name: 'boar' },
      { char: '🐴', name: 'horse' },
      { char: '🦄', name: 'unicorn' },
      { char: '🐝', name: 'bee honey' },
      { char: '🦋', name: 'butterfly' },
      { char: '🐌', name: 'snail slow' },
      { char: '🐞', name: 'ladybug' },
      { char: '🐢', name: 'turtle' },
      { char: '🐍', name: 'snake' },
      { char: '🦎', name: 'lizard' },
      { char: '🦖', name: 'trex dinosaur' },
      { char: '🐙', name: 'octopus' },
      { char: '🦑', name: 'squid' },
      { char: '🦀', name: 'crab' },
      { char: '🐠', name: 'tropical fish' },
      { char: '🐬', name: 'dolphin' },
      { char: '🐳', name: 'whale' },
      { char: '🦈', name: 'shark' },
      { char: '🐊', name: 'crocodile' },
      { char: '🐉', name: 'dragon' },
      { char: '🌵', name: 'cactus' },
      { char: '🌲', name: 'evergreen tree' },
      { char: '🌳', name: 'deciduous tree' },
      { char: '🌴', name: 'palm tree' },
      { char: '🍀', name: 'four leaf clover luck' },
      { char: '🍁', name: 'maple leaf' },
      { char: '🌸', name: 'cherry blossom sakura' },
      { char: '🌹', name: 'rose flower' },
      { char: '🌻', name: 'sunflower' },
      { char: '🌼', name: 'blossom' },
      { char: '🌎', name: 'earth globe world' },
      { char: '🌙', name: 'crescent moon night' },
      { char: '☀️', name: 'sun bright' },
      { char: '⭐', name: 'star' },
      { char: '🌟', name: 'glowing star sparkle' },
      { char: '✨', name: 'sparkles magic shiny' },
      { char: '⚡', name: 'lightning bolt zap energy' },
      { char: '🔥', name: 'fire flame lit hot' },
      { char: '🌈', name: 'rainbow' },
      { char: '❄️', name: 'snowflake frost ice' },
      { char: '🌊', name: 'ocean wave water' },
    ],
  },
  {
    id: 'food',
    label: 'Food & Drink',
    icon: '🍕',
    emojis: [
      { char: '🍎', name: 'red apple fruit' },
      { char: '🍊', name: 'tangerine orange' },
      { char: '🍋', name: 'lemon' },
      { char: '🍌', name: 'banana' },
      { char: '🍉', name: 'watermelon' },
      { char: '🍇', name: 'grapes' },
      { char: '🍓', name: 'strawberry' },
      { char: '🫐', name: 'blueberries' },
      { char: '🍒', name: 'cherries' },
      { char: '🍑', name: 'peach' },
      { char: '🥭', name: 'mango' },
      { char: '🍍', name: 'pineapple' },
      { char: '🥑', name: 'avocado' },
      { char: '🌶️', name: 'hot pepper spicy' },
      { char: '🌽', name: 'corn' },
      { char: '🥕', name: 'carrot' },
      { char: '🍞', name: 'bread' },
      { char: '🥐', name: 'croissant' },
      { char: '🧀', name: 'cheese' },
      { char: '🥚', name: 'egg' },
      { char: '🥞', name: 'pancakes' },
      { char: '🥓', name: 'bacon' },
      { char: '🍗', name: 'poultry leg chicken' },
      { char: '🍔', name: 'burger hamburger' },
      { char: '🍟', name: 'french fries' },
      { char: '🍕', name: 'pizza slice' },
      { char: '🌭', name: 'hot dog' },
      { char: '🌮', name: 'taco' },
      { char: '🌯', name: 'burrito' },
      { char: '🍜', name: 'ramen noodles soup' },
      { char: '🍣', name: 'sushi' },
      { char: '🍤', name: 'fried shrimp' },
      { char: '🍙', name: 'rice ball onigiri' },
      { char: '🥟', name: 'dumpling' },
      { char: '🍦', name: 'ice cream' },
      { char: '🍩', name: 'doughnut donut' },
      { char: '🍪', name: 'cookie' },
      { char: '🎂', name: 'birthday cake' },
      { char: '🍰', name: 'shortcake slice' },
      { char: '🧁', name: 'cupcake' },
      { char: '🍫', name: 'chocolate bar' },
      { char: '🍿', name: 'popcorn movie' },
      { char: '☕', name: 'coffee hot tea' },
      { char: '🍵', name: 'matcha green tea' },
      { char: '🧋', name: 'boba bubble tea' },
      { char: '🥤', name: 'soda cup drink' },
      { char: '🍺', name: 'beer mug' },
      { char: '🍻', name: 'clinking beers cheers' },
      { char: '🥂', name: 'champagne toast cheers' },
      { char: '🍷', name: 'wine glass' },
    ],
  },
  {
    id: 'activities',
    label: 'Activities & Gaming',
    icon: '🎮',
    emojis: [
      { char: '🎮', name: 'video game controller gaming' },
      { char: '🕹️', name: 'joystick arcade' },
      { char: '🎲', name: 'dice luck rng' },
      { char: '♟️', name: 'chess pawn strategy' },
      { char: '🎯', name: 'bullseye target aim' },
      { char: '🎳', name: 'bowling' },
      { char: '⚽', name: 'soccer football' },
      { char: '🏀', name: 'basketball' },
      { char: '🏈', name: 'american football' },
      { char: '⚾', name: 'baseball' },
      { char: '🎾', name: 'tennis' },
      { char: '🏐', name: 'volleyball' },
      { char: '🎱', name: 'pool 8 ball' },
      { char: '🏓', name: 'ping pong' },
      { char: '🥊', name: 'boxing glove fight' },
      { char: '🥇', name: 'gold medal first win' },
      { char: '🥈', name: 'silver medal second' },
      { char: '🥉', name: 'bronze medal third' },
      { char: '🏆', name: 'trophy champion win' },
      { char: '🏅', name: 'sports medal' },
      { char: '🎖️', name: 'military medal' },
      { char: '🎟️', name: 'ticket pass' },
      { char: '🎭', name: 'performing arts theater' },
      { char: '🎨', name: 'artist palette paint art' },
      { char: '🎬', name: 'clapper board video movie' },
      { char: '🎤', name: 'microphone sing voice' },
      { char: '🎧', name: 'headphones audio music' },
      { char: '🎵', name: 'musical note' },
      { char: '🎶', name: 'musical notes song' },
      { char: '🎸', name: 'guitar rock' },
      { char: '🎹', name: 'piano keyboard' },
      { char: '🥁', name: 'drum' },
      { char: '🎉', name: 'party popper confetti celebrate' },
      { char: '🎊', name: 'confetti ball' },
      { char: '🎈', name: 'balloon' },
      { char: '🎁', name: 'wrapped gift present' },
    ],
  },
  {
    id: 'travel',
    label: 'Travel & Places',
    icon: '🚀',
    emojis: [
      { char: '🚀', name: 'rocket launch space' },
      { char: '🛸', name: 'flying saucer ufo' },
      { char: '✈️', name: 'airplane flight' },
      { char: '🚗', name: 'car automobile' },
      { char: '🏎️', name: 'racing car fast' },
      { char: '🚓', name: 'police car' },
      { char: '🚕', name: 'taxi' },
      { char: '🚌', name: 'bus' },
      { char: '🚆', name: 'train' },
      { char: '🚲', name: 'bicycle' },
      { char: '🏍️', name: 'motorcycle' },
      { char: '⛵', name: 'sailboat' },
      { char: '⚓', name: 'anchor' },
      { char: '🗺️', name: 'world map' },
      { char: '🧭', name: 'compass explore' },
      { char: '🏔️', name: 'mountain snow' },
      { char: '🌋', name: 'volcano' },
      { char: '🏖️', name: 'beach umbrella' },
      { char: '🏜️', name: 'desert' },
      { char: '🏝️', name: 'island' },
      { char: '🏟️', name: 'stadium arena' },
      { char: '🏠', name: 'house home' },
      { char: '🏰', name: 'castle' },
      { char: '🗼', name: 'tokyo tower' },
      { char: '🗽', name: 'statue liberty' },
      { char: '🌃', name: 'night stars city' },
      { char: '🌅', name: 'sunrise' },
      { char: '🌌', name: 'milky way galaxy' },
    ],
  },
  {
    id: 'objects',
    label: 'Objects & Tech',
    icon: '💻',
    emojis: [
      { char: '💻', name: 'laptop computer code' },
      { char: '🖥️', name: 'desktop pc monitor' },
      { char: '⌨️', name: 'keyboard' },
      { char: '🖱️', name: 'computer mouse' },
      { char: '📱', name: 'mobile phone smartphone' },
      { char: '📷', name: 'camera photo' },
      { char: '📹', name: 'video camera stream' },
      { char: '📺', name: 'television tv' },
      { char: '📻', name: 'radio' },
      { char: '🔋', name: 'battery power' },
      { char: '🔌', name: 'electric plug' },
      { char: '💡', name: 'light bulb idea' },
      { char: '🔦', name: 'flashlight' },
      { char: '🕯️', name: 'candle' },
      { char: '📡', name: 'satellite dish signal' },
      { char: '🔭', name: 'telescope' },
      { char: '🔬', name: 'microscope' },
      { char: '⚔️', name: 'crossed swords battle' },
      { char: '🛡️', name: 'shield defense protect' },
      { char: '🗡️', name: 'dagger sword' },
      { char: '🏹', name: 'bow and arrow' },
      { char: '💣', name: 'bomb' },
      { char: '🧨', name: 'firecracker' },
      { char: '🔑', name: 'key unlock' },
      { char: '🔒', name: 'locked lock security' },
      { char: '🔓', name: 'unlocked' },
      { char: '🔔', name: 'bell notification alert' },
      { char: '🔕', name: 'muted bell' },
      { char: '📢', name: 'loudspeaker announce' },
      { char: '📣', name: 'megaphone' },
      { char: '📌', name: 'pushpin pin' },
      { char: '📍', name: 'round pushpin location' },
      { char: '📎', name: 'paperclip attach' },
      { char: '🔗', name: 'link chain url' },
      { char: '📝', name: 'memo note write' },
      { char: '📚', name: 'books study' },
      { char: '📖', name: 'open book' },
      { char: '💰', name: 'money bag cash' },
      { char: '💎', name: 'gem diamond crystal' },
      { char: '⚙️', name: 'gear settings config' },
      { char: '🔧', name: 'wrench tool fix' },
      { char: '🔨', name: 'hammer' },
      { char: '⏳', name: 'hourglass time' },
      { char: '⏰', name: 'alarm clock' },
      { char: '📅', name: 'calendar date' },
      { char: '🗑️', name: 'wastebasket trash delete' },
    ],
  },
  {
    id: 'symbols',
    label: 'Symbols & Signs',
    icon: '✅',
    emojis: [
      { char: '✅', name: 'check mark done yes green' },
      { char: '❌', name: 'cross mark no wrong x' },
      { char: '⚠️', name: 'warning alert' },
      { char: '🚫', name: 'prohibited ban no' },
      { char: '⛔', name: 'no entry dnd' },
      { char: '❓', name: 'question mark' },
      { char: '❗', name: 'exclamation mark' },
      { char: '⁉️', name: 'exclamation question' },
      { char: '‼️', name: 'double exclamation' },
      { char: '➕', name: 'plus add' },
      { char: '➖', name: 'minus' },
      { char: '♻️', name: 'recycle' },
      { char: '🔱', name: 'trident emblem' },
      { char: '⚜️', name: 'fleur de lis' },
      { char: '🔰', name: 'beginner' },
      { char: '⭕', name: 'hollow red circle' },
      { char: '🔴', name: 'red circle' },
      { char: '🟠', name: 'orange circle' },
      { char: '🟡', name: 'yellow circle' },
      { char: '🟢', name: 'green circle online' },
      { char: '🔵', name: 'blue circle' },
      { char: '🟣', name: 'purple circle' },
      { char: '⚫', name: 'black circle' },
      { char: '⚪', name: 'white circle' },
      { char: '🔺', name: 'red triangle up' },
      { char: '🔻', name: 'red triangle down' },
      { char: '🔶', name: 'large orange diamond' },
      { char: '🔷', name: 'large blue diamond' },
      { char: '♾️', name: 'infinity' },
      { char: '🔊', name: 'speaker loud sound' },
      { char: '🔇', name: 'muted speaker' },
      { char: '▶️', name: 'play' },
      { char: '⏸️', name: 'pause' },
      { char: '🔁', name: 'repeat loop' },
      { char: '🔀', name: 'shuffle' },
      { char: '⬆️', name: 'up arrow' },
      { char: '⬇️', name: 'down arrow' },
      { char: '⬅️', name: 'left arrow' },
      { char: '➡️', name: 'right arrow' },
      { char: '™️', name: 'trademark' },
      { char: '©️', name: 'copyright' },
      { char: '🆕', name: 'new' },
      { char: '🆙', name: 'up' },
      { char: '🆒', name: 'cool' },
      { char: '🆓', name: 'free' },
      { char: '🆗', name: 'ok' },
      { char: '🆘', name: 'sos help' },
      { char: '🆚', name: 'vs versus' },
    ],
  },
  {
    id: 'flags',
    label: 'Flags',
    icon: '🏁',
    emojis: [
      { char: '🏁', name: 'checkered flag race finish' },
      { char: '🚩', name: 'triangular red flag' },
      { char: '🏴‍☠️', name: 'pirate flag' },
      { char: '🏳️‍🌈', name: 'rainbow pride flag' },
      { char: '🇺🇸', name: 'usa united states flag' },
      { char: '🇬🇧', name: 'uk united kingdom britain flag' },
      { char: '🇨🇦', name: 'canada flag' },
      { char: '🇯🇵', name: 'japan flag' },
      { char: '🇰🇷', name: 'south korea flag' },
      { char: '🇵🇭', name: 'philippines flag' },
      { char: '🇩🇪', name: 'germany flag' },
      { char: '🇫🇷', name: 'france flag' },
      { char: '🇪🇸', name: 'spain flag' },
      { char: '🇮🇹', name: 'italy flag' },
      { char: '🇧🇷', name: 'brazil flag' },
      { char: '🇲🇽', name: 'mexico flag' },
      { char: '🇦🇺', name: 'australia flag' },
      { char: '🇮🇳', name: 'india flag' },
      { char: '🇸🇬', name: 'singapore flag' },
      { char: '🇸🇪', name: 'sweden flag' },
    ],
  },
];

export const ALL_EMOJIS: EmojiEntry[] = EMOJI_CATEGORIES.flatMap((c) => c.emojis);

export function getRecentEmojis(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_EMOJIS_KEY);
    if (!raw) return ['👍', '❤️', '🔥', '😂', '🎮', '✨', '👀', '🚀'];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0
      ? parsed.slice(0, 16)
      : ['👍', '❤️', '🔥', '😂', '🎮', '✨', '👀', '🚀'];
  } catch {
    return ['👍', '❤️', '🔥', '😂', '🎮', '✨', '👀', '🚀'];
  }
}

export function pushRecentEmoji(emoji: string): string[] {
  const current = getRecentEmojis().filter((e) => e !== emoji);
  const next = [emoji, ...current].slice(0, 16);
  try {
    localStorage.setItem(RECENT_EMOJIS_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage quota errors
  }
  return next;
}

/**
 * Discord standard custom emoji processing:
 * - Static images are resized & centered cleanly into 128x128 transparent PNG (Discord's exact emoji upload standard).
 * - Animated GIFs preserve full frame animation untouched so GIF emojis stay animated.
 */
export async function processCustomEmojiFile(file: File): Promise<{
  file: File;
  animated: boolean;
}> {
  const isGif = file.type === 'image/gif' || /\.gif$/i.test(file.name);
  if (isGif) {
    return { file, animated: true };
  }

  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const size = 128; // Discord standard 128x128px
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(url);
          resolve({ file, animated: false });
          return;
        }
        ctx.clearRect(0, 0, size, size);
        const scale = Math.min(size / img.naturalWidth, size / img.naturalHeight);
        const drawW = Math.round(img.naturalWidth * scale);
        const drawH = Math.round(img.naturalHeight * scale);
        const dx = Math.round((size - drawW) / 2);
        const dy = Math.round((size - drawH) / 2);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, dx, dy, drawW, drawH);

        canvas.toBlob(
          (blob) => {
            URL.revokeObjectURL(url);
            if (!blob) {
              resolve({ file, animated: false });
              return;
            }
            const cleanBase = file.name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_') || 'emoji';
            const outFile = new File([blob], `${cleanBase}_128.png`, { type: 'image/png' });
            resolve({ file: outFile, animated: false });
          },
          'image/png',
          0.95
        );
      } catch (err) {
        URL.revokeObjectURL(url);
        reject(err);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({ file, animated: false });
    };
    img.src = url;
  });
}

// Self-contained custom emoji reaction token format: "ce::id::name::url"
export function encodeCustomEmojiReaction(emoji: CustomEmoji): string {
  return `ce::${emoji.id}::${emoji.name}::${emoji.url}`;
}

export function parseCustomEmojiReaction(key: string): {
  id: string;
  name: string;
  url: string;
} | null {
  if (!key.startsWith('ce::')) return null;
  const firstSplit = key.split('::');
  if (firstSplit.length < 4) return null;
  const [, id, name, ...urlParts] = firstSplit;
  const url = urlParts.join('::');
  if (!id || !name || !url) return null;
  return { id, name, url };
}
