const E = require("../js/engine.js");
E.load(require("../data/dict.json"));
const en = process.argv[2] === "ja" ? [] : [
  "I want to eat barbecue sauce on a train",
  "Where is the station?", "How much is this?", "I want to go to Tokyo tomorrow", "Can I try this on?",
  "Do you have a bigger size?", "I don't like spicy food", "This is delicious", "I'm hungry", "I am tired",
  "Can you take a picture of us?", "Let's go!", "I lost my wallet", "Where is the toilet?", "I need a doctor",
  "What do you want to eat?", "I want two beers", "Two beers please", "Water please", "Can I have the menu?",
  "I'm allergic to shrimp", "Is it spicy?", "It's too expensive", "I love Japanese food", "Do you speak English?",
  "I can't speak Japanese", "We are going to Kyoto by train", "My friend is coming later", "I'm at the station",
  "Where are you?", "What is this?", "Is there wifi here?", "Please wait", "Don't worry", "I want a red hoodie",
  "Do you have this in black?", "I'll have the ramen", "I would like a coffee", "Can you help me?",
  "I want to buy shoes for my girlfriend", "Thank you so much", "Excuse me, where is the exit?",
  "I ate sushi yesterday", "I'm eating ramen", "You are cute", "That was fun", "I have a reservation",
  "Do you have a girlfriend?", "Let's drink together tonight", "I want to go home", "I'm lost", "Turn left at the station",
  "How do I get to the airport?", "What time is it?", "Can I pay by card?", "I want to try karaoke",
  "I don't have cash", "This shirt is too small", "Do you like anime?", "I'm a student", "I live in the Netherlands",
  "I want to go shopping", "We should take a taxi", "I have to go", "I am not hungry", "Are you free tonight?",
  "I miss you", "Give me water", "Show me the menu", "Hey, where are you going?", "I bought a new phone",
  "I want to eat sushi because I am hungry", "It is raining", "The ramen was really good", "Can you speak slower?"
];
for (const s of en) {
  const c = E.enToJa(s, "casual"), p = E.enToJa(s, "polite");
  console.log(s.padEnd(46), "|", c.jp, "|", p.jp, "|", c.ro, c.unknown.length ? "  ?" + c.unknown.join(",") : "");
}
if (process.argv[2] === "ja" || process.argv[2] === "all") {
  for (const s of ["電車でバーベキューソースを食べたい", "駅はどこですか？", "これはいくらですか？", "ラーメンが食べたい", "明日東京に行きます", "お腹すいた", "辛いのは好きじゃない",
    "これ美味しい！", "英語を話せますか？", "財布をなくしました", "写真を撮ってもらえますか？", "一緒に行こう", "トイレはどこ？", "ビール二つください", "日本語がわかりません",
    "何を食べたいですか？", "昨日寿司を食べた", "今ラーメンを食べてる", "かわいいね", "楽しかった", "予約しています", "疲れた", "ちょっと待ってください", "カードで払えますか？", "これは何？", "友達と渋谷で遊んだ", "安くなりませんか"]) {
    const r = E.jaToEn(s); console.log(s.padEnd(24, "　"), "|", r.en, "|", r.words.map(w => w.jp + "=" + w.en).join(" "));
  }
}
