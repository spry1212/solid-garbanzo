/**
 * NutriPlan — Enhanced Edition
 *
 * NEW FEATURES:
 * ─────────────────────────────────────────────────────────────────
 * 1. PERSISTENT STATE  — localStorage (Supabase-ready stubs included)
 * 2. MEAL HISTORY LOG  — "Made It" button, journal view, cooldown logic
 * 3. SMART MACRO GEN   — combinatorial solver finds best daily combo
 * 4. LEFTOVER PLANNER  — high-yield dinners auto-propose next-day lunch
 * 5. PRICE TRACKER     — Melbourne pricing with "on special" alerts
 * 6. NUTRITION DIARY   — tick meals as eaten, running macro totals
 * 7. SEASONAL PRODUCE  — Australian seasonal flags by current month
 * 8. BATCH COOK MODE   — pick 2–3 batch meals, merged shopping list
 *
 * SUPABASE INTEGRATION POINTS (marked // SUPABASE):
 *   - Auth: supabase.auth.signInWithOAuth({ provider: 'google' })
 *   - DB:   supabase.from('meal_plans').upsert(...)
 *   - All localStorage calls swap 1:1 with Supabase equivalents
 */

import { useState, useEffect } from "react";

// ── COLOURS ───────────────────────────────────────────────────────────────────
const sage = "#4a6b4e", sageL = "#d4e6d6", sageXL = "#eef5ef";
const terra = "#993C1D", terraL = "#f2e0d6";
const gold = "#854F0B", goldM = "#C9A84C", goldL = "#FBF5E6";
const blue = "#185FA5", blueL = "#E6F1FB";
const plum = "#3C3489", plumL = "#EEEDFE";
const teal = "#0F6E56", tealL = "#E1F5EE";
const pink = "#9B2060", pinkL = "#fce8f3";
const mid = "#5F5E5A", light = "#B4B2A9", rule = "#D3D1C7", charcoal = "#1a1a18";
const cardBg = "#ffffff", surfaceBg = "#fafaf9", pageBg = "#f5f4f0";

const SLOT_COLORS = { breakfast: goldM, lunch: teal, dinner: terra, snack: plum, dessert: pink };
const SLOT_BG     = { breakfast: goldL, lunch: tealL, dinner: terraL, snack: plumL, dessert: pinkL };

const DAYS  = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
const SLOTS = ["breakfast","lunch","dinner","snack","dessert"];
const CUISINES = ["Mediterranean","Italian","Asian","Japanese","Korean","Mexican","Indian","Middle Eastern","American","Thai","Greek","French","Australian"];
const DIETS    = ["None","Vegetarian","Vegan","Gluten-Free","Dairy-Free","Halal","Keto","Paleo"];
const EQUIP    = ["Stovetop","Oven","Microwave","Air Fryer","Slow Cooker","Blender","Food Processor","BBQ/Grill"];

// ── STYLE HELPERS ─────────────────────────────────────────────────────────────
function pill(bg, col) { return { fontSize:10,fontWeight:700,padding:"2px 7px",borderRadius:20,background:bg,color:col,whiteSpace:"nowrap",display:"inline-block" }; }
function btn(bg, col, sm) { return { fontFamily:"inherit",fontSize:sm?10:12,fontWeight:600,padding:sm?"3px 8px":"7px 14px",borderRadius:50,border:"none",background:bg,color:col,cursor:"pointer",lineHeight:1.4 }; }
function navBtn(active) { return { fontFamily:"inherit",fontSize:12,fontWeight:500,padding:"5px 12px",borderRadius:50,border:"1px solid "+(active?sage:rule),background:active?sage:"transparent",color:active?"#fff":mid,cursor:"pointer" }; }
function tag(col, bg)   { return { fontSize:9,fontWeight:700,padding:"2px 6px",borderRadius:20,background:bg,color:col,textTransform:"uppercase",letterSpacing:"0.6px",display:"inline-block" }; }
function mbar(pct, col) { return { height:5,borderRadius:3,background:col,width:Math.min(100,pct)+"%",transition:"width 0.3s" }; }
const cardStyle   = { background:cardBg,borderRadius:12,border:"1px solid "+rule,overflow:"hidden" };
const inpStyle    = { fontFamily:"inherit",fontSize:13,padding:"7px 10px",border:"1px solid "+rule,borderRadius:8,background:surfaceBg,color:charcoal,outline:"none",width:"100%",boxSizing:"border-box" };
const selStyle    = { fontFamily:"inherit",fontSize:12,padding:"5px 8px",border:"1px solid "+rule,borderRadius:7,background:surfaceBg,color:charcoal,outline:"none" };
const overlayStyle = { position:"fixed",inset:0,background:"rgba(10,10,8,.55)",zIndex:900,display:"flex",alignItems:"flex-end",justifyContent:"center" };
const drawerStyle  = { background:cardBg,width:"100%",maxWidth:700,maxHeight:"93vh",borderRadius:"18px 18px 0 0",display:"flex",flexDirection:"column",overflow:"hidden" };
const h3Style = { fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.7px",color:mid,margin:"0 0 8px" };

// ── RECIPE DATABASE ───────────────────────────────────────────────────────────
const RECIPES = [
  // BREAKFAST
  { id:"b1", name:"Protein Berry & Chia Bowl",       slot:"breakfast", cuisine:["Mediterranean"], diet:["Vegetarian","Gluten-Free"], equipment:["Microwave"], prepTime:5,  cookTime:0,  totalTime:5,  baseServings:2, macros:{protein:29,carbs:28,fat:9, calories:360}, ingredients:[{name:"Protein powder",qty:30,unit:"g",cat:"pantry"},{name:"Greek yoghurt",qty:150,unit:"g",cat:"dairy"},{name:"Almond milk",qty:100,unit:"ml",cat:"dairy"},{name:"Chia seeds",qty:20,unit:"g",cat:"pantry"},{name:"Frozen mixed berries",qty:80,unit:"g",cat:"frozen"},{name:"Honey",qty:5,unit:"g",cat:"pantry"}], steps:["Mix chia seeds with almond milk. Refrigerate overnight.","Blend protein powder with Greek yoghurt.","Layer chia pudding, yoghurt, and berries.","Drizzle honey and serve."], source:"builtin" },
  { id:"b2", name:"Smashed Avo & Poached Eggs",      slot:"breakfast", cuisine:["Australian"],    diet:["Vegetarian","Dairy-Free"],  equipment:["Stovetop"],  prepTime:5,  cookTime:8,  totalTime:13, baseServings:2, macros:{protein:26,carbs:32,fat:20,calories:490}, ingredients:[{name:"Sourdough bread",qty:2,unit:"slices",cat:"bakery"},{name:"Eggs",qty:2,unit:"whole",cat:"dairy"},{name:"Avocado",qty:1,unit:"whole",cat:"produce"},{name:"Lemon",qty:0.5,unit:"whole",cat:"produce"},{name:"Feta",qty:30,unit:"g",cat:"deli"},{name:"Chilli flakes",qty:1,unit:"g",cat:"pantry"}], steps:["Toast sourdough until golden.","Mash avocado with lemon juice, salt and pepper.","Poach eggs in simmering water 3 min.","Top toast with avo, eggs, feta and chilli flakes."], source:"builtin" },
  { id:"b3", name:"Protein Pancakes",                slot:"breakfast", cuisine:["American"],      diet:["Vegetarian","Gluten-Free"], equipment:["Stovetop","Blender"], prepTime:5, cookTime:10, totalTime:15, baseServings:2, macros:{protein:32,carbs:35,fat:10,calories:430}, ingredients:[{name:"Rolled oats",qty:80,unit:"g",cat:"pantry"},{name:"Banana",qty:1,unit:"whole",cat:"produce"},{name:"Eggs",qty:2,unit:"whole",cat:"dairy"},{name:"Protein powder",qty:30,unit:"g",cat:"pantry"},{name:"Cinnamon",qty:2,unit:"g",cat:"pantry"}], steps:["Blend all ingredients until smooth.","Pour 3 tbsp per pancake. Cook 2–3 min per side.","Serve with yoghurt and berries."], source:"builtin" },
  { id:"b4", name:"Shakshuka with Feta",             slot:"breakfast", cuisine:["Mediterranean"], diet:["Vegetarian"],              equipment:["Stovetop"],  prepTime:5,  cookTime:20, totalTime:25, baseServings:2, macros:{protein:28,carbs:35,fat:16,calories:460}, ingredients:[{name:"Eggs",qty:3,unit:"whole",cat:"dairy"},{name:"Crushed tomatoes",qty:400,unit:"g",cat:"pantry"},{name:"Brown onion",qty:0.5,unit:"whole",cat:"produce"},{name:"Garlic",qty:2,unit:"cloves",cat:"produce"},{name:"Smoked paprika",qty:3,unit:"g",cat:"pantry"},{name:"Ground cumin",qty:3,unit:"g",cat:"pantry"},{name:"Baby spinach",qty:60,unit:"g",cat:"produce"},{name:"Feta",qty:50,unit:"g",cat:"deli"},{name:"Sourdough",qty:2,unit:"slices",cat:"bakery"}], steps:["Fry onion and garlic in olive oil 5 min.","Add spices, crushed tomatoes, spinach. Simmer 8 min.","Make 3 wells, crack eggs in. Cover 5–7 min.","Scatter feta. Serve with sourdough."], source:"builtin" },
  { id:"b5", name:"Overnight Oats with Banana",      slot:"breakfast", cuisine:["American"],      diet:["Vegetarian","Vegan","Dairy-Free","Gluten-Free"], equipment:[], prepTime:5, cookTime:0, totalTime:5, baseServings:2, macros:{protein:14,carbs:52,fat:8,calories:380}, ingredients:[{name:"Rolled oats",qty:80,unit:"g",cat:"pantry"},{name:"Oat milk",qty:200,unit:"ml",cat:"pantry"},{name:"Chia seeds",qty:10,unit:"g",cat:"pantry"},{name:"Banana",qty:1,unit:"whole",cat:"produce"},{name:"Peanut butter",qty:20,unit:"g",cat:"pantry"},{name:"Honey",qty:8,unit:"g",cat:"pantry"}], steps:["Combine oats, oat milk and chia seeds. Stir well.","Refrigerate overnight.","Top with sliced banana, peanut butter and honey."], source:"builtin" },
  { id:"b6", name:"Egg White Omelette & Spinach",    slot:"breakfast", cuisine:["Mediterranean"], diet:["Vegetarian","Gluten-Free","Dairy-Free"], equipment:["Stovetop"], prepTime:5, cookTime:8, totalTime:13, baseServings:2, macros:{protein:24,carbs:6,fat:6,calories:260}, ingredients:[{name:"Egg whites",qty:6,unit:"whole",cat:"dairy"},{name:"Baby spinach",qty:80,unit:"g",cat:"produce"},{name:"Cherry tomatoes",qty:80,unit:"g",cat:"produce"},{name:"Garlic",qty:1,unit:"clove",cat:"produce"},{name:"Olive oil",qty:10,unit:"ml",cat:"pantry"}], steps:["Sauté garlic and tomatoes in olive oil 2 min.","Add spinach, wilt 1 min.","Pour egg whites over. Cook on low, folding edges in.","Slide onto plate and fold."], source:"builtin" },
  // LUNCH
  { id:"l1", name:"Chickpea & Cauliflower Bowl",     slot:"lunch", cuisine:["Mediterranean"], diet:["Vegan","Gluten-Free","Dairy-Free"], equipment:["Oven"],     prepTime:10, cookTime:30, totalTime:40, baseServings:2, macros:{protein:22,carbs:52,fat:14,calories:460}, ingredients:[{name:"Cauliflower",qty:400,unit:"g",cat:"produce"},{name:"Chickpeas",qty:400,unit:"g",cat:"pantry"},{name:"Ground cumin",qty:3,unit:"g",cat:"pantry"},{name:"Smoked paprika",qty:3,unit:"g",cat:"pantry"},{name:"Baby spinach",qty:60,unit:"g",cat:"produce"},{name:"Tahini",qty:20,unit:"g",cat:"pantry"},{name:"Greek yoghurt",qty:40,unit:"g",cat:"dairy"},{name:"Lemon",qty:0.5,unit:"whole",cat:"produce"}], steps:["Preheat oven 210°C.","Toss cauliflower and chickpeas with oil, cumin, paprika. Roast 25–30 min.","Whisk yoghurt, tahini, lemon juice into a dressing.","Serve over spinach with dressing drizzled over."], source:"builtin" },
  { id:"l2", name:"Chicken & Avocado Grain Bowl",    slot:"lunch", cuisine:["Asian"],          diet:["Gluten-Free","Dairy-Free"],    equipment:["Stovetop"], prepTime:10, cookTime:15, totalTime:25, baseServings:2, macros:{protein:48,carbs:42,fat:18,calories:520}, ingredients:[{name:"Chicken breast",qty:150,unit:"g",cat:"protein"},{name:"Brown rice",qty:160,unit:"g",cat:"pantry"},{name:"Avocado",qty:0.5,unit:"whole",cat:"produce"},{name:"Edamame",qty:50,unit:"g",cat:"frozen"},{name:"Carrot",qty:1,unit:"whole",cat:"produce"},{name:"White miso paste",qty:15,unit:"g",cat:"pantry"},{name:"Sesame oil",qty:5,unit:"ml",cat:"pantry"},{name:"Sesame seeds",qty:5,unit:"g",cat:"pantry"}], steps:["Poach chicken in simmering water 12–14 min. Slice.","Whisk miso, vinegar, sesame oil into dressing.","Assemble: rice, avocado, edamame, carrot, chicken.","Drizzle dressing and scatter sesame seeds."], source:"builtin" },
  { id:"l3", name:"Korean Beef Bibimbap",            slot:"lunch", cuisine:["Korean"],         diet:["Gluten-Free","Dairy-Free"],    equipment:["Stovetop"], prepTime:15, cookTime:15, totalTime:30, baseServings:2, macros:{protein:44,carbs:48,fat:17,calories:530}, ingredients:[{name:"Beef mince",qty:150,unit:"g",cat:"protein"},{name:"Brown rice",qty:160,unit:"g",cat:"pantry"},{name:"Baby spinach",qty:60,unit:"g",cat:"produce"},{name:"Carrot",qty:1,unit:"whole",cat:"produce"},{name:"Zucchini",qty:1,unit:"whole",cat:"produce"},{name:"Egg",qty:1,unit:"whole",cat:"dairy"},{name:"Gochujang paste",qty:20,unit:"g",cat:"pantry"},{name:"Sesame oil",qty:5,unit:"ml",cat:"pantry"},{name:"Soy sauce",qty:15,unit:"ml",cat:"pantry"}], steps:["Cook beef with garlic, soy, gochujang and sesame oil.","Sauté spinach with sesame oil until wilted.","Fry egg sunny side up.","Build bowl: rice, veg, beef. Top with egg and gochujang."], source:"builtin" },
  { id:"l4", name:"Tuna Niçoise Salad",              slot:"lunch", cuisine:["French"],          diet:["Gluten-Free","Dairy-Free"],    equipment:["Stovetop"], prepTime:10, cookTime:15, totalTime:25, baseServings:2, macros:{protein:38,carbs:32,fat:14,calories:450}, ingredients:[{name:"Tinned tuna",qty:185,unit:"g",cat:"pantry"},{name:"Green beans",qty:100,unit:"g",cat:"produce"},{name:"Eggs",qty:2,unit:"whole",cat:"dairy"},{name:"Cherry tomatoes",qty:100,unit:"g",cat:"produce"},{name:"Baby potatoes",qty:150,unit:"g",cat:"produce"},{name:"Mixed olives",qty:30,unit:"g",cat:"pantry"},{name:"Dijon mustard",qty:5,unit:"g",cat:"pantry"},{name:"Olive oil",qty:15,unit:"ml",cat:"pantry"}], steps:["Boil potatoes 15 min. Drain and cool.","Blanch green beans 2 min. Ice water.","Hard-boil eggs 9–10 min. Peel and halve.","Arrange on a platter. Drizzle dressing."], source:"builtin" },
  { id:"l5", name:"Pesto Pasta with Chicken",        slot:"lunch", cuisine:["Italian"],         diet:[],                              equipment:["Stovetop"], prepTime:10, cookTime:15, totalTime:25, baseServings:2, macros:{protein:42,carbs:55,fat:18,calories:560}, ingredients:[{name:"Pasta",qty:160,unit:"g",cat:"pantry"},{name:"Chicken breast",qty:150,unit:"g",cat:"protein"},{name:"Basil pesto",qty:40,unit:"g",cat:"pantry"},{name:"Cherry tomatoes",qty:100,unit:"g",cat:"produce"},{name:"Parmesan",qty:20,unit:"g",cat:"deli"},{name:"Baby spinach",qty:40,unit:"g",cat:"produce"}], steps:["Cook pasta in salted water. Reserve ½ cup pasta water.","Season and pan-fry chicken 4 min per side. Slice.","Toss drained pasta with pesto, tomatoes, spinach, and pasta water.","Top with chicken and parmesan."], source:"builtin" },
  { id:"l6", name:"Greek Lamb Salad",                slot:"lunch", cuisine:["Greek"],            diet:["Gluten-Free"],                 equipment:["Stovetop","BBQ/Grill"], prepTime:10, cookTime:12, totalTime:22, baseServings:2, macros:{protein:40,carbs:18,fat:22,calories:510}, ingredients:[{name:"Lamb backstrap",qty:250,unit:"g",cat:"protein"},{name:"Cos lettuce",qty:1,unit:"whole",cat:"produce"},{name:"Cucumber",qty:1,unit:"whole",cat:"produce"},{name:"Cherry tomatoes",qty:120,unit:"g",cat:"produce"},{name:"Red onion",qty:0.5,unit:"whole",cat:"produce"},{name:"Feta",qty:80,unit:"g",cat:"deli"},{name:"Kalamata olives",qty:40,unit:"g",cat:"pantry"},{name:"Lemon",qty:1,unit:"whole",cat:"produce"},{name:"Olive oil",qty:20,unit:"ml",cat:"pantry"}], steps:["Season lamb. Grill or pan-fry 3–4 min per side for medium. Rest 5 min and slice.","Combine lettuce, cucumber, tomatoes, onion, olives and feta.","Whisk lemon juice, olive oil, salt, pepper for dressing.","Arrange lamb on salad and drizzle dressing."], source:"builtin" },
  // DINNER
  { id:"d1", name:"Moroccan Chicken & Couscous",     slot:"dinner", cuisine:["Mediterranean"], diet:["Halal"],                equipment:["Stovetop","Oven"], prepTime:15, cookTime:40, totalTime:55, baseServings:2, yieldServings:4, macros:{protein:54,carbs:45,fat:22,calories:620}, leftoversSlot:"lunch", leftoversName:"Moroccan Chicken Wrap", ingredients:[{name:"Chicken thighs",qty:350,unit:"g",cat:"protein"},{name:"Harissa paste",qty:30,unit:"g",cat:"pantry"},{name:"Crushed tomatoes",qty:200,unit:"g",cat:"pantry"},{name:"Chicken stock",qty:150,unit:"ml",cat:"pantry"},{name:"Preserved lemon",qty:20,unit:"g",cat:"pantry"},{name:"Green olives",qty:30,unit:"g",cat:"pantry"},{name:"Couscous",qty:100,unit:"g",cat:"pantry"},{name:"Brown onion",qty:0.5,unit:"whole",cat:"produce"},{name:"Garlic",qty:2,unit:"cloves",cat:"produce"},{name:"Fresh coriander",qty:10,unit:"g",cat:"produce"}], steps:["Brown chicken 3–4 min per side. Remove.","Fry onion 5 min. Add garlic and harissa 1 min.","Add tomatoes, stock, preserved lemon, olives.","Return chicken. Simmer covered 30–35 min.","Pour boiling stock over couscous, cover 5 min, fluff.","Serve chicken on couscous topped with coriander."], tip:"Makes 4 serves — leftovers make a great next-day wrap.", source:"builtin", batchable:true },
  { id:"d2", name:"Garlic Baked Salmon with White Beans", slot:"dinner", cuisine:["Mediterranean"], diet:["Gluten-Free","Dairy-Free"], equipment:["Oven"], prepTime:10, cookTime:20, totalTime:30, baseServings:2, macros:{protein:56,carbs:28,fat:24,calories:560}, ingredients:[{name:"Salmon fillet",qty:200,unit:"g",cat:"protein"},{name:"Cannellini beans",qty:200,unit:"g",cat:"pantry"},{name:"Zucchini",qty:150,unit:"g",cat:"produce"},{name:"Cherry tomatoes",qty:150,unit:"g",cat:"produce"},{name:"Garlic",qty:3,unit:"cloves",cat:"produce"},{name:"Flat-leaf parsley",qty:10,unit:"g",cat:"produce"},{name:"Lemon",qty:0.5,unit:"whole",cat:"produce"},{name:"Olive oil",qty:15,unit:"ml",cat:"pantry"}], steps:["Preheat oven 200°C.","Toss zucchini, tomatoes, garlic with oil. Roast 15 min.","Add beans to tray. Place salmon in centre.","Press parsley-lemon crust on fish. Roast 12–15 min.","Squeeze lemon over everything."], source:"builtin" },
  { id:"d3", name:"Air Fryer Pork Chops & Fennel",   slot:"dinner", cuisine:["Italian"],         diet:["Gluten-Free","Dairy-Free"], equipment:["Air Fryer"], prepTime:10, cookTime:20, totalTime:30, baseServings:2, macros:{protein:56,carbs:28,fat:20,calories:610}, ingredients:[{name:"Pork loin chops",qty:300,unit:"g",cat:"protein"},{name:"Fennel bulb",qty:1,unit:"whole",cat:"produce"},{name:"Green apple",qty:0.5,unit:"whole",cat:"produce"},{name:"Cannellini beans",qty:200,unit:"g",cat:"pantry"},{name:"Fennel seeds",qty:3,unit:"g",cat:"pantry"},{name:"Sherry vinegar",qty:10,unit:"ml",cat:"pantry"},{name:"Olive oil",qty:10,unit:"ml",cat:"pantry"}], steps:["Season chops with salt, pepper, fennel seeds.","Toss fennel and apple with oil. Air fry 200°C 8 min.","Add chops. Cook 10–12 min, flipping once.","Warm beans with sherry vinegar. Lightly crush.","Rest pork 3 min. Serve over beans and fennel."], source:"builtin" },
  { id:"d4", name:"Chicken Ramen Bowl",               slot:"dinner", cuisine:["Japanese"],        diet:["Dairy-Free"],              equipment:["Stovetop"],  prepTime:10, cookTime:25, totalTime:35, baseServings:2, macros:{protein:42,carbs:45,fat:13,calories:490}, ingredients:[{name:"Chicken breast",qty:200,unit:"g",cat:"protein"},{name:"Chicken stock",qty:600,unit:"ml",cat:"pantry"},{name:"Ramen noodles",qty:85,unit:"g",cat:"pantry"},{name:"Egg",qty:1,unit:"whole",cat:"dairy"},{name:"Corn",qty:60,unit:"g",cat:"pantry"},{name:"Spring onion",qty:2,unit:"whole",cat:"produce"},{name:"Soy sauce",qty:30,unit:"ml",cat:"pantry"},{name:"Mirin",qty:15,unit:"ml",cat:"pantry"},{name:"White miso paste",qty:15,unit:"g",cat:"pantry"},{name:"Sesame oil",qty:3,unit:"ml",cat:"pantry"}], steps:["Simmer chicken in stock with soy and mirin 15–18 min. Slice.","Whisk miso into broth off the heat.","Soft-boil egg 6.5 min. Ice bath. Peel and halve.","Cook ramen noodles. Drain. Divide between bowls.","Ladle broth over noodles. Arrange toppings. Finish with sesame oil."], source:"builtin" },
  { id:"d5", name:"Slow-Braised Beef Short Ribs",     slot:"dinner", cuisine:["Italian"],         diet:["Gluten-Free"],             equipment:["Stovetop","Oven","Slow Cooker"], prepTime:20, cookTime:180, totalTime:200, baseServings:2, macros:{protein:58,carbs:38,fat:28,calories:720}, ingredients:[{name:"Beef short ribs",qty:350,unit:"g",cat:"protein"},{name:"Red wine",qty:150,unit:"ml",cat:"pantry"},{name:"Crushed tomatoes",qty:200,unit:"g",cat:"pantry"},{name:"Brown onion",qty:0.5,unit:"whole",cat:"produce"},{name:"Celery",qty:1,unit:"whole",cat:"produce"},{name:"Carrot",qty:0.5,unit:"whole",cat:"produce"},{name:"Beef stock",qty:250,unit:"ml",cat:"pantry"},{name:"Polenta",qty:75,unit:"g",cat:"pantry"},{name:"Parmesan",qty:30,unit:"g",cat:"deli"},{name:"Butter",qty:15,unit:"g",cat:"dairy"}], steps:["Season and sear ribs 3–4 min per side. Remove.","Sauté mirepoix 5 min. Deglaze with wine 3 min.","Add tomatoes, stock, herbs. Return ribs. Cover.","Braise 160°C for 2.5–3 hours.","Make polenta, stir in parmesan and butter.","Serve ribs on polenta with braising sauce."], tip:"This improves overnight — make ahead.", source:"builtin" },
  { id:"d6", name:"Lamb Kofta & Bulgur Tabbouleh",    slot:"dinner", cuisine:["Middle Eastern"],  diet:["Dairy-Free","Halal"],      equipment:["Stovetop","BBQ/Grill"], prepTime:20, cookTime:12, totalTime:32, baseServings:2, macros:{protein:42,carbs:40,fat:18,calories:510}, ingredients:[{name:"Lean lamb mince",qty:225,unit:"g",cat:"protein"},{name:"Brown onion",qty:0.25,unit:"whole",cat:"produce"},{name:"Garlic",qty:1,unit:"clove",cat:"produce"},{name:"Ground cumin",qty:2,unit:"g",cat:"pantry"},{name:"Ground coriander",qty:2,unit:"g",cat:"pantry"},{name:"Bulgur wheat",qty:100,unit:"g",cat:"pantry"},{name:"Flat-leaf parsley",qty:20,unit:"g",cat:"produce"},{name:"Mint",qty:10,unit:"g",cat:"produce"},{name:"Tomatoes",qty:1,unit:"whole",cat:"produce"},{name:"Cucumber",qty:0.5,unit:"whole",cat:"produce"},{name:"Lemon",qty:1,unit:"whole",cat:"produce"},{name:"Olive oil",qty:15,unit:"ml",cat:"pantry"}], steps:["Soak bulgur in boiling water 20 min. Drain.","Mix lamb with grated onion, garlic, spices. Shape into koftas.","Grill or pan-fry 3–4 min per side.","Make tabbouleh: chop parsley and mint, combine with bulgur, tomato, cucumber, lemon, oil.","Serve kofta on tabbouleh."], source:"builtin" },
  // SNACK
  { id:"s1", name:"Greek Yoghurt & Berry Parfait",    slot:"snack",   cuisine:["Mediterranean"], diet:["Vegetarian","Gluten-Free"], equipment:[], prepTime:3, cookTime:0, totalTime:3, baseServings:2, macros:{protein:15,carbs:22,fat:3, calories:175}, ingredients:[{name:"Greek yoghurt",qty:150,unit:"g",cat:"dairy"},{name:"Mixed berries",qty:80,unit:"g",cat:"produce"},{name:"Granola",qty:30,unit:"g",cat:"pantry"},{name:"Honey",qty:5,unit:"g",cat:"pantry"}], steps:["Layer yoghurt, berries, and granola.","Drizzle honey. Serve immediately."], source:"builtin" },
  { id:"s2", name:"Dark Chocolate & Almonds",         slot:"snack",   cuisine:["Mediterranean"], diet:["Vegan","Gluten-Free","Dairy-Free"], equipment:[], prepTime:1, cookTime:0, totalTime:1, baseServings:2, macros:{protein:5,carbs:10,fat:16,calories:200}, ingredients:[{name:"Dark chocolate (70%+)",qty:25,unit:"g",cat:"pantry"},{name:"Almonds",qty:30,unit:"g",cat:"pantry"}], steps:["Break chocolate into pieces.","Eat together."], source:"builtin" },
  { id:"s3", name:"Rice Crackers & Hummus",           slot:"snack",   cuisine:["Middle Eastern"],diet:["Vegan","Gluten-Free","Dairy-Free"], equipment:[], prepTime:2, cookTime:0, totalTime:2, baseServings:2, macros:{protein:6,carbs:28,fat:9,calories:210}, ingredients:[{name:"Rice crackers",qty:30,unit:"g",cat:"pantry"},{name:"Hummus",qty:60,unit:"g",cat:"pantry"},{name:"Cucumber",qty:0.5,unit:"whole",cat:"produce"}], steps:["Slice cucumber.","Serve crackers and cucumber with hummus."], source:"builtin" },
  { id:"s4", name:"Apple & Peanut Butter",            slot:"snack",   cuisine:["American"],      diet:["Vegan","Gluten-Free","Dairy-Free"], equipment:[], prepTime:2, cookTime:0, totalTime:2, baseServings:2, macros:{protein:7,carbs:25,fat:10,calories:210}, ingredients:[{name:"Apple",qty:1,unit:"whole",cat:"produce"},{name:"Peanut butter",qty:30,unit:"g",cat:"pantry"}], steps:["Slice apple.","Serve with peanut butter for dipping."], source:"builtin" },
  // DESSERT
  { id:"de1", name:"Banana Nice Cream",              slot:"dessert",  cuisine:["American"],      diet:["Vegan","Gluten-Free","Dairy-Free"], equipment:["Blender"], prepTime:5, cookTime:0, totalTime:5, baseServings:2, macros:{protein:4,carbs:28,fat:6,calories:175}, ingredients:[{name:"Frozen banana",qty:2,unit:"whole",cat:"frozen"},{name:"Peanut butter",qty:15,unit:"g",cat:"pantry"},{name:"Cacao powder",qty:5,unit:"g",cat:"pantry"}], steps:["Freeze ripe bananas at least 4 hours.","Blend frozen banana until smooth and creamy.","Add peanut butter and cacao. Blend again.","Serve immediately as soft-serve."], tip:"Bananas must be very ripe before freezing.", source:"builtin" },
  { id:"de2", name:"Chocolate Chia Pudding",         slot:"dessert",  cuisine:["Mediterranean"], diet:["Vegan","Gluten-Free","Dairy-Free"], equipment:[], prepTime:5, cookTime:0, totalTime:5, baseServings:2, macros:{protein:8,carbs:22,fat:10,calories:200}, ingredients:[{name:"Chia seeds",qty:40,unit:"g",cat:"pantry"},{name:"Coconut milk",qty:200,unit:"ml",cat:"pantry"},{name:"Cacao powder",qty:15,unit:"g",cat:"pantry"},{name:"Honey",qty:15,unit:"g",cat:"pantry"},{name:"Mixed berries",qty:60,unit:"g",cat:"produce"}], steps:["Whisk chia seeds, coconut milk, cacao and honey together.","Refrigerate overnight.","Stir well before serving.","Top with fresh berries."], source:"builtin" },
  { id:"de3", name:"Figs & Ricotta with Honey",      slot:"dessert",  cuisine:["Italian"],       diet:["Vegetarian","Gluten-Free"], equipment:[], prepTime:3, cookTime:0, totalTime:3, baseServings:2, macros:{protein:8,carbs:20,fat:9,calories:185}, ingredients:[{name:"Fresh figs",qty:3,unit:"whole",cat:"produce"},{name:"Ricotta",qty:100,unit:"g",cat:"dairy"},{name:"Walnuts",qty:20,unit:"g",cat:"pantry"},{name:"Honey",qty:10,unit:"g",cat:"pantry"}], steps:["Halve the figs and arrange on a plate.","Spoon ricotta alongside.","Scatter walnuts and drizzle with honey.","Serve at room temperature."], source:"builtin" },
  { id:"de4", name:"Baked Cinnamon Apple",           slot:"dessert",  cuisine:["Australian"],    diet:["Vegan","Gluten-Free","Dairy-Free"], equipment:["Oven"], prepTime:5, cookTime:20, totalTime:25, baseServings:2, macros:{protein:1,carbs:28,fat:4,calories:145}, ingredients:[{name:"Apple",qty:2,unit:"whole",cat:"produce"},{name:"Cinnamon",qty:2,unit:"g",cat:"pantry"},{name:"Honey",qty:15,unit:"g",cat:"pantry"},{name:"Walnuts",qty:20,unit:"g",cat:"pantry"},{name:"Coconut oil",qty:10,unit:"g",cat:"pantry"}], steps:["Preheat oven 180°C.","Core apples, leaving base intact.","Mix honey, cinnamon, coconut oil, walnuts. Fill the cavities.","Bake 20 min until soft but holding shape."], source:"builtin" },
];

// ── PERSISTENCE ───────────────────────────────────────────────────────────────
function persist(k, v) { try { localStorage.setItem("np4_"+k, JSON.stringify(v)); } catch(e) {} }
function recall(k, fb) { try { const v = localStorage.getItem("np4_"+k); return v ? JSON.parse(v) : fb; } catch(e) { return fb; } }

// ── PLAN SOLVER ───────────────────────────────────────────────────────────────
function solveDay(pool, targets, usedIds, withDessert) {
  const bySlot = {};
  SLOTS.forEach(sl => {
    if (!withDessert && sl === "dessert") return;
    bySlot[sl] = pool.filter(r => r.slot === sl && !usedIds.has(r.id)).slice(0, 6);
  });
  if (!bySlot.breakfast || !bySlot.breakfast.length) return null;
  if (!bySlot.lunch     || !bySlot.lunch.length)     return null;
  if (!bySlot.dinner    || !bySlot.dinner.length)     return null;
  let best = null, bestScore = -1;
  const sn = (bySlot.snack  || [])[0] || null;
  const desserts = withDessert ? (bySlot.dessert || [null]) : [null];
  for (let fi = 0; fi < bySlot.breakfast.length; fi++) {
    for (let li = 0; li < bySlot.lunch.length; li++) {
      for (let di = 0; di < bySlot.dinner.length; di++) {
        for (let dsi = 0; dsi < desserts.length; dsi++) {
          const f = bySlot.breakfast[fi], l = bySlot.lunch[li], d = bySlot.dinner[di], ds = desserts[dsi];
          const tot = {
            protein:  f.macros.protein  + l.macros.protein  + d.macros.protein  + (sn?sn.macros.protein:0)  + (ds?ds.macros.protein:0),
            carbs:    f.macros.carbs    + l.macros.carbs    + d.macros.carbs    + (sn?sn.macros.carbs:0)    + (ds?ds.macros.carbs:0),
            fat:      f.macros.fat      + l.macros.fat      + d.macros.fat      + (sn?sn.macros.fat:0)      + (ds?ds.macros.fat:0),
            calories: f.macros.calories + l.macros.calories + d.macros.calories + (sn?sn.macros.calories:0) + (ds?ds.macros.calories:0),
          };
          const score = 1 / (1 + (Math.abs(tot.protein-targets.protein)/(targets.protein||1))*2 + (Math.abs(tot.calories-targets.calories)/(targets.calories||1))*2 + (Math.abs(tot.fat-targets.fat)/(targets.fat||1)) + (Math.abs(tot.carbs-targets.carbs)/(targets.carbs||1)));
          if (score > bestScore) { bestScore = score; best = { breakfast:f, lunch:l, dinner:d, snack:sn, dessert:ds }; }
        }
      }
    }
  }
  return best;
}

function buildPlan(prefs, targets, equipment, pinned, allRecipes, history, servings, withDessert) {
  const now = Date.now();
  const recentIds = new Set(history.filter(h => (now - new Date(h.date).getTime()) / 86400000 < 7).map(h => h.recipeId));
  const { cuisines: favC = [], diet = "None", exclude = [] } = prefs;
  const filtered = allRecipes.filter(r => {
    if (!withDessert && r.slot === "dessert") return false;
    if (diet && diet !== "None" && !r.diet.includes(diet)) return false;
    if (r.equipment.length > 0 && !r.equipment.some(eq => equipment.includes(eq))) return false;
    if (exclude.length > 0 && r.ingredients.some(i => exclude.some(ex => i.name.toLowerCase().includes(ex.toLowerCase())))) return false;
    return true;
  });
  const pool = filtered.map(r => ({ ...r, _score: (favC.length>0&&r.cuisine.some(c=>favC.includes(c))?1.3:1.0) * (r.source!=="builtin"?1.2:1.0) * (recentIds.has(r.id)?0.1:1.0) * (0.8+Math.random()*0.4) })).sort((a,b) => b._score - a._score);
  const plan = {};
  const usedIds = new Set();
  DAYS.forEach(day => {
    plan[day] = {};
    // Inject pinned meals first
    SLOTS.forEach(sl => {
      if (pinned[day] && pinned[day][sl]) {
        plan[day][sl] = { ...pinned[day][sl], pinned: true, enabled: true };
        usedIds.add(pinned[day][sl].id);
      }
    });
    // Solve remaining slots
    const adjT = { ...targets };
    SLOTS.forEach(sl => {
      if (plan[day][sl]) { const m = plan[day][sl].macros || {}; adjT.protein -= m.protein||0; adjT.carbs -= m.carbs||0; adjT.fat -= m.fat||0; adjT.calories -= m.calories||0; }
    });
    const best = solveDay(pool.filter(r => !usedIds.has(r.id)), adjT, usedIds, withDessert);
    if (best) {
      SLOTS.forEach(sl => {
        if (!plan[day][sl] && best[sl]) { plan[day][sl] = { ...best[sl], enabled: true, repeating: false }; usedIds.add(best[sl].id); }
      });
    }
  });
  return plan;
}

function buildShopList(plan, servings) {
  const items = {};
  Object.values(plan).forEach(day => {
    Object.values(day).forEach(meal => {
      if (!meal || meal.enabled === false) return;
      (meal.ingredients || []).forEach(ing => {
        const key = ing.name.toLowerCase().trim();
        if (items[key]) { items[key].qty += (ing.qty||0) * servings; }
        else { items[key] = { name:ing.name, qty:(ing.qty||0)*servings, unit:ing.unit, cat:ing.cat||"other", checked:false, adHoc:false }; }
      });
    });
  });
  return items;
}

// ── REUSABLE TINY COMPONENTS ──────────────────────────────────────────────────
function DrawerHandle() { return <div style={{ width:36, height:4, background:rule, borderRadius:2, margin:"10px auto 0", flexShrink:0 }} />; }
function Stars({ value, onChange }) {
  return (
    <div style={{ display:"flex", gap:3 }}>
      {[1,2,3,4,5].map(n => <span key={n} onClick={() => onChange && onChange(n)} style={{ fontSize:20, cursor:onChange?"pointer":"default", color:n<=(value||0)?"#F4B400":rule }}>★</span>)}
    </div>
  );
}

// ── MAIN APP ──────────────────────────────────────────────────────────────────
export default function App() {
  const [targets,     setTargets]     = useState(() => recall("targets",   { protein:120, carbs:180, fat:70, calories:1800 }));
  const [prefs,       setPrefs]       = useState(() => recall("prefs",     { cuisines:[], diet:"None", exclude:[] }));
  const [equipment,   setEquipment]   = useState(() => recall("equip",     ["Stovetop","Oven","Microwave","Air Fryer","Blender"]));
  const [servings,    setServings]    = useState(() => recall("servings",  2));
  const [withDessert, setWithDessert] = useState(() => recall("dessert",   false));
  const [custom,      setCustom]      = useState(() => recall("custom",    []));
  const [history,     setHistory]     = useState(() => recall("history",   []));
  // pinned[day][slot] = recipe — user's "always use this" selections
  const [pinned,      setPinned]      = useState(() => recall("pinned",    {}));
  const [plan,        setPlan]        = useState(null);
  const [shopList,    setShopList]    = useState({});
  const [selDay,      setSelDay]      = useState("Monday");
  const [tab,         setTab]         = useState("plan");
  const [viewMode,    setViewMode]    = useState("day"); // "day" | "week"
  const [openMeal,    setOpenMeal]    = useState(null);
  const [scale,       setScale]       = useState(1);
  const [adHoc,       setAdHoc]       = useState("");
  const [shopView,    setShopView]    = useState("category");
  const [showSum,     setShowSum]     = useState(false);
  const [showHist,    setShowHist]    = useState(false);
  const [showEdit,    setShowEdit]    = useState(false);
  const [showLib,     setShowLib]     = useState(false);
  const [showUrl,     setShowUrl]     = useState(false);
  // Picker modal state
  const [pickerOpen,  setPickerOpen]  = useState(false);
  const [pickerDay,   setPickerDay]   = useState(null);
  const [pickerSlot,  setPickerSlot]  = useState(null);
  const [pickerSearch,setPickerSearch]= useState("");
  const [draft,       setDraft]       = useState(null);
  const [editId,      setEditId]      = useState(null);
  const [libSearch,   setLibSearch]   = useState("");
  const [libFilter,   setLibFilter]   = useState("all");
  const [impUrl,      setImpUrl]      = useState("");
  const [impStatus,   setImpStatus]   = useState("idle");
  const [impErr,      setImpErr]      = useState("");
  const [impPrev,     setImpPrev]     = useState(null);

  const allRecipes = [...RECIPES, ...custom];

  useEffect(() => { persist("targets",  targets);     }, [targets]);
  useEffect(() => { persist("prefs",    prefs);       }, [prefs]);
  useEffect(() => { persist("equip",    equipment);   }, [equipment]);
  useEffect(() => { persist("servings", servings);    }, [servings]);
  useEffect(() => { persist("dessert",  withDessert); }, [withDessert]);
  useEffect(() => { persist("custom",   custom);      }, [custom]);
  useEffect(() => { persist("history",  history);     }, [history]);
  useEffect(() => { persist("pinned",   pinned);      }, [pinned]);

  useEffect(() => {
    const saved = recall("plan", null);
    if (saved) { setPlan(saved); } else { regen(); }
  }, []);

  useEffect(() => {
    if (!plan) return;
    const list = buildShopList(plan, servings);
    setShopList(prev => {
      const m = {};
      Object.entries(list).forEach(([k,v]) => { m[k] = { ...v, checked: prev[k] ? prev[k].checked : false }; });
      Object.entries(prev).forEach(([k,v]) => { if (v.adHoc && !m[k]) m[k] = v; });
      return m;
    });
  }, [plan, servings]);

  function regen() {
    const p = buildPlan(prefs, targets, equipment, pinned, allRecipes, history, servings, withDessert);
    setPlan(p); persist("plan", p);
  }

  function dayTotals(day) {
    return SLOTS.reduce((acc, slot) => {
      const m = plan && plan[day] && plan[day][slot];
      if (!m || m.enabled === false) return acc;
      return { protein: acc.protein+(m.macros?m.macros.protein:0), carbs: acc.carbs+(m.macros?m.macros.carbs:0), fat: acc.fat+(m.macros?m.macros.fat:0), calories: acc.calories+(m.macros?m.macros.calories:0) };
    }, { protein:0, carbs:0, fat:0, calories:0 });
  }

  function toggleMeal(day, slot) {
    setPlan(prev => {
      const n = { ...prev, [day]: { ...prev[day], [slot]: { ...prev[day][slot], enabled: !prev[day][slot].enabled } } };
      persist("plan", n); return n;
    });
  }
  function swapMeal(day, slot) {
    const cur = plan[day] && plan[day][slot];
    const pool = allRecipes.filter(r => r.slot===slot && r.id!==(cur&&cur.id) && (prefs.diet==="None"||r.diet.includes(prefs.diet)) && (r.equipment.length===0||r.equipment.some(eq=>equipment.includes(eq))));
    if (!pool.length) return;
    const pick = { ...pool[Math.floor(Math.random()*pool.length)], enabled:true, pinned:false };
    setPlan(prev => { const n = { ...prev, [day]: { ...prev[day], [slot]: pick } }; persist("plan", n); return n; });
  }

  // ── PINNING ────────────────────────────────────────────────────────────────
  // Pin/unpin a meal from the current plan
  function togglePin(day, slot) {
    const meal = plan && plan[day] && plan[day][slot];
    if (!meal) return;
    if (meal.pinned) {
      // Unpin
      setPinned(p => { const n = { ...p }; if (n[day]) { delete n[day][slot]; if (!Object.keys(n[day]).length) delete n[day]; } return n; });
      setPlan(prev => { const n = { ...prev, [day]: { ...prev[day], [slot]: { ...meal, pinned: false } } }; persist("plan", n); return n; });
    } else {
      // Pin current meal
      const recipe = allRecipes.find(r => r.id === meal.id) || meal;
      setPinned(p => ({ ...p, [day]: { ...(p[day]||{}), [slot]: recipe } }));
      setPlan(prev => { const n = { ...prev, [day]: { ...prev[day], [slot]: { ...meal, pinned: true } } }; persist("plan", n); return n; });
    }
  }

  // Open picker to choose a specific recipe for a day+slot
  function openPicker(day, slot) {
    setPickerDay(day); setPickerSlot(slot); setPickerSearch(""); setPickerOpen(true);
  }

  // Select a recipe from the picker
  function pickRecipe(recipe) {
    const day = pickerDay, slot = pickerSlot;
    const meal = { ...recipe, enabled: true, pinned: true };
    // Also pin it
    setPinned(p => ({ ...p, [day]: { ...(p[day]||{}), [slot]: recipe } }));
    setPlan(prev => { const n = { ...prev, [day]: { ...prev[day], [slot]: meal } }; persist("plan", n); return n; });
    setPickerOpen(false);
  }

  // Clear a pin for a day+slot (and regenerate just that slot randomly)
  function clearPin(day, slot) {
    setPinned(p => { const n = { ...p }; if (n[day]) { delete n[day][slot]; if (!Object.keys(n[day]).length) delete n[day]; } return n; });
    swapMeal(day, slot);
  }

  function logMadeIt(meal, day, slot, rating, comment, wma) {
    setHistory(h => [{ recipeId:meal.id, recipeName:meal.name, day, slot, date:new Date().toISOString(), rating, comment, wouldMakeAgain:wma }, ...h].slice(0, 200));
    setPlan(prev => { const n = { ...prev, [day]: { ...prev[day], [slot]: { ...prev[day][slot], userRating:rating, userComment:comment, wouldMakeAgain:wma } } }; persist("plan", n); return n; });
  }

  function weeklyStats() {
    const days = DAYS.map(d => dayTotals(d));
    const sum = k => days.reduce((a,d) => a+d[k], 0);
    const avg = k => Math.round(sum(k)/7);
    const daysOT = days.filter(d => Math.abs(d.calories-targets.calories)/(targets.calories||1) < 0.15).length;
    return { avg:{ protein:avg("protein"), carbs:avg("carbs"), fat:avg("fat"), calories:avg("calories") }, total:{ protein:sum("protein"), carbs:sum("carbs"), fat:sum("fat"), calories:sum("calories") }, daysOT, days };
  }

  // Editor helpers
  function blankDraft() { return { id:"c"+Date.now(), name:"", slot:"dinner", cuisine:[], diet:[], equipment:[], prepTime:15, cookTime:30, totalTime:45, baseServings:2, macros:{protein:0,carbs:0,fat:0,calories:0}, ingredients:[{name:"",qty:"",unit:"g",cat:"produce"}], steps:[""], tip:"", source:"custom", sourceUrl:"" }; }
  function openNewRecipe() { setDraft(blankDraft()); setEditId(null); setShowEdit(true); }
  function openEditRecipe(r) { setDraft({...r, ingredients:r.ingredients.map(i=>({...i})), steps:[...r.steps]}); setEditId(r.id); setShowEdit(true); }
  function saveDraft() {
    const r = { ...draft, totalTime:(parseInt(draft.prepTime)||0)+(parseInt(draft.cookTime)||0), macros:{...draft.macros, calories:draft.macros.calories||Math.round(draft.macros.protein*4+draft.macros.carbs*4+draft.macros.fat*9)} };
    if (editId) { setCustom(c => c.map(x => x.id===editId?r:x)); } else { setCustom(c => [...c,r]); }
    setShowEdit(false); setDraft(null); setEditId(null);
  }
  function setDraftField(k,v) { setDraft(d => ({...d,[k]:v})); }
  function setDraftMacro(k,v) { setDraft(d => ({...d, macros:{...d.macros,[k]:Number(v)||0}})); }
  function setIngField(i,k,v) { setDraft(d => { const ings=[...d.ingredients]; ings[i]={...ings[i],[k]:v}; return {...d,ingredients:ings}; }); }
  function toggleDraftArr(k,v) { setDraft(d => ({...d,[k]:d[k].includes(v)?d[k].filter(x=>x!==v):[...d[k],v]})); }

  async function doImport() {
    if (!impUrl.trim()) return;
    setImpStatus("loading"); setImpErr(""); setImpPrev(null);
    try {
      const prompt = 'Parse this recipe URL and return ONLY valid JSON (no markdown): {"name":"...","slot":"breakfast|lunch|dinner|snack|dessert","cuisine":["..."],"diet":["..."],"equipment":["..."],"prepTime":15,"cookTime":25,"totalTime":40,"baseServings":2,"macros":{"protein":35,"carbs":40,"fat":15,"calories":450},"ingredients":[{"name":"...","qty":200,"unit":"g","cat":"produce|protein|dairy|pantry|frozen|bakery|deli|other"}],"steps":["Step 1."],"tip":"","sourceUrl":"' + impUrl.trim() + '"}\nURL: ' + impUrl.trim();
      const resp = await fetch("https://api.anthropic.com/v1/messages", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ model:"claude-sonnet-4-20250514", max_tokens:1000, messages:[{role:"user",content:prompt}] }) });
      if (!resp.ok) throw new Error("API error "+resp.status);
      const data = await resp.json();
      const text = data.content.map(b=>b.text||"").join("").trim().replace(/```json|```/g,"").trim();
      setImpPrev({ ...JSON.parse(text), id:"c"+Date.now(), source:"url", rating:null, wouldMakeAgain:false, enabled:true });
      setImpStatus("success");
    } catch(e) { setImpStatus("error"); setImpErr(e.message||"Failed."); }
  }
  function saveImport() { if(!impPrev)return; setCustom(c=>[...c,impPrev]); setShowUrl(false); setImpPrev(null); setImpUrl(""); setImpStatus("idle"); }

  // ── COMPACT SLOT CELL (used in week view) ────────────────────────────────
  function SlotCell({ meal, day, slot, compact }) {
    const enabled = !meal || meal.enabled !== false;
    const isPinned = meal && meal.pinned;
    const noMeal = !meal;
    return (
      <div
        style={{ background: noMeal ? surfaceBg : (enabled ? cardBg : "#f8f8f8"), borderRadius: 8, border: "1px solid " + (isPinned ? goldM : rule), padding: compact ? "6px 7px" : "8px 9px", cursor:"pointer", minHeight: compact ? 60 : 80, display:"flex", flexDirection:"column", justifyContent:"space-between", position:"relative", opacity: enabled ? 1 : 0.5 }}
        onClick={() => { if (meal) { setOpenMeal({ meal, day, slot }); setScale(1); } else { openPicker(day, slot); } }}
      >
        {isPinned && <div style={{ position:"absolute", top:3, right:4, fontSize:9, color:goldM }}>📌</div>}
        {noMeal ? (
          <div style={{ fontSize:10, color:light, textAlign:"center", marginTop:8 }}>+ Add</div>
        ) : (
          <>
            <div style={{ fontSize:10, fontWeight:600, color: SLOT_COLORS[slot], textTransform:"uppercase", letterSpacing:"0.5px", marginBottom:2 }}>{slot.slice(0,4)}</div>
            <div style={{ fontSize: compact ? 10 : 11, fontWeight:600, color:charcoal, lineHeight:1.3, marginBottom:3 }}>{meal.name.length > 28 ? meal.name.slice(0,26)+"…" : meal.name}</div>
            <div style={{ display:"flex", gap:3, flexWrap:"wrap" }}>
              <span style={{ fontSize:8, fontWeight:700, color:blue }}>{meal.macros && meal.macros.protein}P</span>
              <span style={{ fontSize:8, fontWeight:700, color:terra }}>{meal.macros && meal.macros.calories}cal</span>
            </div>
          </>
        )}
      </div>
    );
  }

  // ── WEEK VIEW ─────────────────────────────────────────────────────────────
  function WeekView() {
    if (!plan) return <div style={{ textAlign:"center", padding:"40px 0", color:mid }}>Generating…</div>;
    const visibleSlots = SLOTS.filter(sl => withDessert || sl !== "dessert");
    return (
      <div style={{ overflowX:"auto" }}>
        {/* Sticky header row */}
        <div style={{ display:"grid", gridTemplateColumns:"60px repeat(7,1fr)", gap:6, marginBottom:6, minWidth:700 }}>
          <div />
          {DAYS.map(day => {
            const t = dayTotals(day);
            const ok = t.calories > 0 && Math.abs(t.calories-targets.calories)/(targets.calories||1) < 0.15;
            return (
              <div key={day} style={{ textAlign:"center", padding:"6px 4px", background: ok ? tealL : surfaceBg, borderRadius:8, border:"1px solid "+(ok?"#9FE1CB":rule) }}>
                <div style={{ fontSize:11, fontWeight:700, color: ok ? teal : charcoal }}>{day.slice(0,3)}</div>
                <div style={{ fontSize:9, color:mid }}>{t.calories} cal</div>
                <div style={{ fontSize:9, color:blue }}>{t.protein}g P</div>
              </div>
            );
          })}
        </div>
        {/* Slot rows */}
        {visibleSlots.map(slot => (
          <div key={slot} style={{ display:"grid", gridTemplateColumns:"60px repeat(7,1fr)", gap:6, marginBottom:6, minWidth:700 }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"flex-end", paddingRight:8 }}>
              <span style={{ fontSize:9, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.6px", color:SLOT_COLORS[slot] }}>{slot}</span>
            </div>
            {DAYS.map(day => (
              <SlotCell key={day} meal={plan[day] && plan[day][slot]} day={day} slot={slot} compact />
            ))}
          </div>
        ))}
        {/* Day total macro bars */}
        <div style={{ display:"grid", gridTemplateColumns:"60px repeat(7,1fr)", gap:6, minWidth:700, marginTop:4 }}>
          <div />
          {DAYS.map(day => {
            const t = dayTotals(day);
            return (
              <div key={day} style={{ padding:"6px 6px", background:surfaceBg, borderRadius:8, border:"1px solid "+rule }}>
                {[{label:"P",val:t.protein,tgt:targets.protein,col:blue},{label:"F",val:t.fat,tgt:targets.fat,col:gold},{label:"C",val:t.calories,tgt:targets.calories,col:terra}].map(m => (
                  <div key={m.label} style={{ marginBottom:3 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", fontSize:8, color:mid, marginBottom:1 }}>
                      <span>{m.label}</span><span style={{ color:m.col, fontWeight:600 }}>{Math.round(m.val)}</span>
                    </div>
                    <div style={{ background:rule, borderRadius:2, height:3, overflow:"hidden" }}>
                      <div style={{ ...mbar(m.tgt>0?(m.val/m.tgt)*100:0, m.col), height:3 }} />
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ── MEAL PICKER MODAL ─────────────────────────────────────────────────────
  function MealPickerModal() {
    if (!pickerOpen) return null;
    const slot = pickerSlot;
    const day  = pickerDay;
    // Group recipes: pinned templates first, then by slot
    const slotRecipes = allRecipes.filter(r => r.slot === slot && (pickerSearch === "" || r.name.toLowerCase().includes(pickerSearch.toLowerCase())));
    // Global pinned presets for this slot across all days
    const pinnedForSlot = new Set();
    Object.values(pinned).forEach(dayPins => { if (dayPins[slot]) pinnedForSlot.add(dayPins[slot].id); });
    // Current meal in plan for this cell
    const currentId = plan && plan[day] && plan[day][slot] ? plan[day][slot].id : null;

    return (
      <div style={overlayStyle} onClick={e => { if (e.target === e.currentTarget) setPickerOpen(false); }}>
        <div style={{ ...drawerStyle, maxWidth:600 }}>
          <DrawerHandle />
          <div style={{ padding:"14px 18px 12px", borderBottom:"1px solid "+rule, flexShrink:0 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
              <div>
                <div style={{ fontFamily:"Georgia,serif", fontSize:15, fontWeight:600 }}>
                  Pick a meal
                </div>
                <div style={{ fontSize:11, color:mid, marginTop:2 }}>
                  {day} · <span style={{ color:SLOT_COLORS[slot], fontWeight:600 }}>{slot}</span>
                  &nbsp;— this will be pinned 📌 to this slot
                </div>
              </div>
              <button onClick={() => setPickerOpen(false)} style={{ ...btn(surfaceBg,mid), border:"1px solid "+rule, borderRadius:50, padding:"5px 10px" }}>✕</button>
            </div>
            <input
              style={inpStyle}
              placeholder={"Search " + slot + " recipes…"}
              value={pickerSearch}
              onChange={e => setPickerSearch(e.target.value)}
              autoFocus
            />
          </div>
          <div style={{ overflowY:"auto", flex:1, padding:"12px 18px 20px", display:"flex", flexDirection:"column", gap:8 }}>
            {/* Clear pin option */}
            {plan && plan[day] && plan[day][slot] && plan[day][slot].pinned && (
              <div
                onClick={() => { clearPin(day, slot); setPickerOpen(false); }}
                style={{ ...cardStyle, padding:"11px 14px", border:"1.5px dashed "+rule, cursor:"pointer", display:"flex", alignItems:"center", gap:10 }}
              >
                <span style={{ fontSize:18 }}>🔀</span>
                <div>
                  <div style={{ fontWeight:600, fontSize:13 }}>Remove pin & auto-fill</div>
                  <div style={{ fontSize:11, color:mid }}>Let the planner choose freely for this slot</div>
                </div>
              </div>
            )}
            {slotRecipes.length === 0 && (
              <div style={{ textAlign:"center", padding:"30px 0", color:light }}>No {slot} recipes found.</div>
            )}
            {slotRecipes.map(r => {
              const isCurrentPick = r.id === currentId;
              const isPinnedElsewhere = pinnedForSlot.has(r.id) && !isCurrentPick;
              return (
                <div
                  key={r.id}
                  onClick={() => pickRecipe(r)}
                  style={{ ...cardStyle, padding:"11px 14px", border:"1.5px solid "+(isCurrentPick?sage:rule), background:isCurrentPick?sageXL:cardBg, cursor:"pointer", display:"flex", gap:12, alignItems:"flex-start" }}
                >
                  <div style={{ flex:1 }}>
                    <div style={{ display:"flex", gap:5, marginBottom:3, flexWrap:"wrap" }}>
                      {r.cuisine.slice(0,2).map(c => <span key={c} style={tag(sage,sageXL)}>{c}</span>)}
                      {r.diet.slice(0,2).map(d => <span key={d} style={tag(teal,tealL)}>{d}</span>)}
                      {r.source !== "builtin" && <span style={tag(plum,plumL)}>Mine</span>}
                      {isPinnedElsewhere && <span style={tag(gold,goldL)}>📌 Used</span>}
                    </div>
                    <div style={{ fontFamily:"Georgia,serif", fontSize:14, fontWeight:600, marginBottom:2 }}>{r.name}</div>
                    <div style={{ fontSize:11, color:mid }}>⏱ {r.totalTime}min · {r.equipment.join(", ") || "No equipment"}</div>
                    <div style={{ display:"flex", gap:5, marginTop:5 }}>
                      <span style={pill(blueL,  blue)}>P {r.macros && r.macros.protein}g</span>
                      <span style={pill("#e8f4e8", teal)}>C {r.macros && r.macros.carbs}g</span>
                      <span style={pill(goldL,  gold)}>F {r.macros && r.macros.fat}g</span>
                      <span style={pill(terraL, terra)}>{r.macros && r.macros.calories} cal</span>
                    </div>
                  </div>
                  {isCurrentPick && <div style={{ fontSize:18, flexShrink:0 }}>✓</div>}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ── MEAL CARD (day view) ──────────────────────────────────────────────────
  function MealCard({ meal, day, slot }) {
    if (!meal) {
      return (
        <div
          onClick={() => openPicker(day, slot)}
          style={{ ...cardStyle, border:"1.5px dashed "+rule, background:surfaceBg, padding:"14px 12px", opacity:0.7, cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:4, minHeight:80 }}
        >
          <div style={{ fontSize:18, color:light }}>+</div>
          <div style={{ fontSize:11, color:light }}>Pick a {slot}</div>
        </div>
      );
    }
    const enabled = meal.enabled !== false;
    const isPinned = meal.pinned;
    return (
      <div style={{ ...cardStyle, opacity:enabled?1:0.38, border:"1px solid "+(isPinned?goldM:rule), background:enabled?cardBg:surfaceBg }}>
        <div style={{ padding:"10px 10px 9px" }}>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4, alignItems:"flex-start" }}>
            <span style={{ fontSize:9, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.8px", color:SLOT_COLORS[slot] }}>{slot}</span>
            <div style={{ display:"flex", gap:3, flexWrap:"wrap", justifyContent:"flex-end" }}>
              {isPinned && <span style={tag(gold,goldL)}>📌 Pinned</span>}
              {meal.userRating && <span style={{ fontSize:9, color:"#F4B400" }}>{"★".repeat(meal.userRating)}</span>}
            </div>
          </div>
          <div onClick={() => { setOpenMeal({meal,day,slot}); setScale(1); }} style={{ fontFamily:"Georgia,serif", fontSize:12, fontWeight:600, lineHeight:1.35, marginBottom:3, color:charcoal, cursor:"pointer" }}>{meal.name}</div>
          <div style={{ fontSize:9, color:light, marginBottom:6 }}>⏱ {meal.totalTime}min{meal.equipment&&meal.equipment.length>0&&" · "+meal.equipment.slice(0,2).join(", ")}</div>
          <div style={{ display:"flex", gap:3, flexWrap:"wrap", marginBottom:7 }}>
            <span style={pill(blueL,blue)}>P {meal.macros&&meal.macros.protein}g</span>
            <span style={pill("#e8f4e8",teal)}>C {meal.macros&&meal.macros.carbs}g</span>
            <span style={pill(goldL,gold)}>F {meal.macros&&meal.macros.fat}g</span>
            <span style={pill(terraL,terra)}>{meal.macros&&meal.macros.calories} cal</span>
          </div>
          <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
            <button style={btn(sageXL,sage,true)} onClick={e => { e.stopPropagation(); setOpenMeal({meal,day,slot}); setScale(1); }}>Recipe</button>
            <button style={btn(surfaceBg,mid,true)} onClick={e => { e.stopPropagation(); toggleMeal(day,slot); }}>{enabled?"Skip":"Include"}</button>
            <button style={btn(surfaceBg,mid,true)} onClick={e => { e.stopPropagation(); swapMeal(day,slot); }}>Swap</button>
            <button style={btn(isPinned?goldL:surfaceBg, isPinned?gold:mid, true)} onClick={e => { e.stopPropagation(); togglePin(day,slot); }}>
              {isPinned ? "📌 Unpin" : "📌 Pin"}
            </button>
            <button style={btn(blueL,blue,true)} onClick={e => { e.stopPropagation(); openPicker(day,slot); }}>Change</button>
          </div>
        </div>
      </div>
    );
  }

  // ── RECIPE DRAWER ─────────────────────────────────────────────────────────
  function RecipeDrawer() {
    if (!openMeal) return null;
    const { meal, day, slot } = openMeal;
    const [rating,  setRating]  = useState(meal.userRating    || 0);
    const [comment, setComment] = useState(meal.userComment   || "");
    const [wma,     setWma]     = useState(meal.wouldMakeAgain|| false);
    const eff = servings * scale;
    const sm = {
      protein:  Math.round((meal.macros?meal.macros.protein:0)  * scale * servings),
      carbs:    Math.round((meal.macros?meal.macros.carbs:0)    * scale * servings),
      fat:      Math.round((meal.macros?meal.macros.fat:0)      * scale * servings),
      calories: Math.round((meal.macros?meal.macros.calories:0) * scale * servings),
    };
    function sq(qty) { const v = (qty||0)*eff; return v < 1 ? v.toFixed(1) : Math.round(v); }
    return (
      <div style={overlayStyle} onClick={e => { if(e.target===e.currentTarget) setOpenMeal(null); }}>
        <div style={drawerStyle}>
          <DrawerHandle />
          <div style={{ padding:"14px 18px 10px", borderBottom:"1px solid "+rule, flexShrink:0 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:9, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.8px", color:SLOT_COLORS[slot], marginBottom:3 }}>{slot}</div>
                <div style={{ fontFamily:"Georgia,serif", fontSize:18, fontWeight:600, lineHeight:1.2, marginBottom:4 }}>{meal.name}</div>
                <div style={{ fontSize:11, color:mid }}>Base {meal.baseServings} serves · Prep {meal.prepTime}min · Cook {meal.cookTime}min{meal.equipment&&meal.equipment.length>0&&" · "+meal.equipment.join(", ")}</div>
              </div>
              <button onClick={() => setOpenMeal(null)} style={{ ...btn(surfaceBg,mid), border:"1px solid "+rule, borderRadius:50, padding:"5px 10px", flexShrink:0 }}>✕</button>
            </div>
            {/* Scale */}
            <div style={{ display:"flex", alignItems:"center", gap:8, marginTop:12, background:sageXL, borderRadius:10, padding:"8px 12px", flexWrap:"wrap" }}>
              <span style={{ fontSize:11, fontWeight:600, color:sage }}>Scale</span>
              {[0.5,1,1.5,2,3,4].map(m => (
                <button key={m} onClick={() => setScale(m)} style={{ ...btn(scale===m?sage:cardBg, scale===m?"#fff":mid, true), border:"1px solid "+(scale===m?sage:rule), padding:"3px 9px", fontSize:11 }}>
                  {m===1?"1×":m+"×"}
                </button>
              ))}
              <span style={{ fontSize:11, color:mid, marginLeft:"auto" }}>= <strong style={{ color:sage }}>{eff} serves</strong></span>
            </div>
          </div>
          {/* Macro strip */}
          <div style={{ display:"flex", gap:8, padding:"10px 18px", borderBottom:"1px solid "+rule, flexShrink:0 }}>
            {[{label:"Protein",val:sm.protein,col:blue},{label:"Carbs",val:sm.carbs,col:teal},{label:"Fat",val:sm.fat,col:gold},{label:"Calories",val:sm.calories,col:terra}].map(m => (
              <div key={m.label} style={{ flex:1, background:surfaceBg, borderRadius:8, padding:"7px 8px", textAlign:"center" }}>
                <div style={{ fontSize:9, color:mid, textTransform:"uppercase" }}>{m.label}</div>
                <div style={{ fontSize:15, fontWeight:700, color:m.col }}>{m.val}</div>
                {scale !== 1 && <div style={{ fontSize:8, color:light }}>per serve: {Math.round(m.val/eff)}</div>}
              </div>
            ))}
          </div>
          <div style={{ overflowY:"auto", flex:1, padding:"16px 18px 28px" }}>
            <div style={{ ...h3Style, marginBottom:8 }}>Ingredients {scale!==1&&<span style={{color:sage}}>({eff} serves)</span>}</div>
            <div style={{ border:"1px solid "+rule, borderRadius:8, overflow:"hidden", marginBottom:18 }}>
              {meal.ingredients && meal.ingredients.map((ing, i) => (
                <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"7px 12px", borderBottom:i<meal.ingredients.length-1?"1px solid "+rule:"none", background:i%2===0?sageXL:cardBg }}>
                  <span style={{ fontSize:12 }}>{ing.name}</span>
                  <span style={{ fontSize:12, fontWeight:600 }}>{sq(ing.qty)} {ing.unit}</span>
                </div>
              ))}
            </div>
            <div style={h3Style}>Method</div>
            <div style={{ display:"flex", flexDirection:"column", gap:10, marginBottom:18 }}>
              {meal.steps && meal.steps.map((step,i) => (
                <div key={i} style={{ display:"flex", gap:10, alignItems:"flex-start" }}>
                  <div style={{ width:22, height:22, borderRadius:"50%", background:sage, color:"#fff", fontSize:10, fontWeight:700, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, marginTop:1 }}>{i+1}</div>
                  <div style={{ fontSize:12.5, lineHeight:1.55, paddingTop:2 }}>{step}</div>
                </div>
              ))}
            </div>
            {meal.tip && <div style={{ background:goldL, border:"1px solid #e8d5a0", borderRadius:8, padding:"10px 12px", marginBottom:18, fontSize:11.5, color:gold }}><strong>💡 Tip:</strong> {meal.tip}</div>}
            <div style={{ ...cardStyle, padding:"12px 14px" }}>
              <div style={{ fontWeight:600, marginBottom:8 }}>Rate & log</div>
              <Stars value={rating} onChange={setRating} />
              <textarea placeholder="Notes…" value={comment} onChange={e => setComment(e.target.value)} style={{ ...inpStyle, marginTop:10, resize:"vertical", minHeight:55, fontSize:12 }} />
              <label style={{ display:"flex", alignItems:"center", gap:6, marginTop:8, fontSize:12, cursor:"pointer" }}>
                <input type="checkbox" checked={wma} onChange={e => setWma(e.target.checked)} /> Would make again
              </label>
              <button onClick={() => { logMadeIt(meal,day,slot,rating,comment,wma); setOpenMeal(null); }} style={{ ...btn(sage,"#fff"), marginTop:10 }}>✓ Save &amp; Log "Made It"</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── PLAN TAB ──────────────────────────────────────────────────────────────
  function PlanTab() {
    if (!plan) return <div style={{ textAlign:"center", padding:"40px 0", color:mid }}>Generating your plan…</div>;
    const tots = dayTotals(selDay);
    const totalPinned = Object.values(pinned).reduce((s,dp) => s + Object.keys(dp).length, 0);
    return (
      <div>
        {/* Controls */}
        <div style={{ display:"flex", gap:8, marginBottom:12, flexWrap:"wrap", alignItems:"center" }}>
          <button onClick={regen} style={btn(sage,"#fff")}>✨ Generate Week</button>
          <button onClick={() => setShowSum(true)}  style={{ ...btn(sageXL,sage), border:"1px solid "+sageL }}>📊 Summary</button>
          <button onClick={() => setShowLib(true)}  style={{ ...btn(surfaceBg,mid), border:"1px solid "+rule }}>📚 Recipes</button>
          <button onClick={openNewRecipe}           style={{ ...btn(surfaceBg,mid), border:"1px solid "+rule }}>+ Add Recipe</button>
          <button onClick={() => setShowUrl(true)}  style={{ ...btn(surfaceBg,mid), border:"1px solid "+rule }}>🔗 Import URL</button>
          <button onClick={() => setShowHist(true)} style={{ ...btn(surfaceBg,mid), border:"1px solid "+rule }}>📖 History</button>
          <label style={{ display:"flex", alignItems:"center", gap:6, fontSize:12, cursor:"pointer", background:withDessert?pinkL:surfaceBg, border:"1px solid "+(withDessert?pink:rule), borderRadius:50, padding:"5px 12px", color:withDessert?pink:mid, fontWeight:600 }}>
            <input type="checkbox" checked={withDessert} onChange={e => setWithDessert(e.target.checked)} style={{ accentColor:pink }} /> 🍮 Dessert
          </label>
          {totalPinned > 0 && (
            <span style={{ ...pill(goldL,gold), fontSize:11, padding:"4px 10px" }}>📌 {totalPinned} pinned</span>
          )}
          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
            <span style={{ fontSize:11, color:mid }}>Serves:</span>
            {[1,2,3,4].map(n => <button key={n} onClick={() => setServings(n)} style={btn(n===servings?sage:surfaceBg,n===servings?"#fff":mid,true)}>{n}</button>)}
          </div>
        </div>

        {/* View mode toggle + day selector */}
        <div style={{ display:"flex", gap:8, marginBottom:12, alignItems:"center", flexWrap:"wrap" }}>
          <button onClick={() => setViewMode("day")}  style={navBtn(viewMode==="day")}>Day View</button>
          <button onClick={() => setViewMode("week")} style={navBtn(viewMode==="week")}>Week View</button>
          {viewMode === "day" && (
            <div style={{ display:"flex", gap:6, overflowX:"auto", flex:1 }}>
              {DAYS.map(day => {
                const t = dayTotals(day);
                const ok = t.calories > 0 && Math.abs(t.calories-targets.calories)/(targets.calories||1) < 0.15;
                const hasPins = pinned[day] && Object.keys(pinned[day]).length > 0;
                return (
                  <button key={day} onClick={() => setSelDay(day)} style={{ ...navBtn(selDay===day), flexShrink:0, flexDirection:"column", display:"flex", gap:2, padding:"6px 10px", borderColor: selDay===day?sage:ok?"#9FE1CB":rule, background:selDay===day?sage:ok?tealL:"transparent", color:selDay===day?"#fff":mid }}>
                    <span style={{ fontSize:11, fontWeight:600 }}>{day.slice(0,3)}</span>
                    <span style={{ fontSize:9, opacity:0.8 }}>{t.calories} cal</span>
                    {hasPins && <span style={{ fontSize:8 }}>📌</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {viewMode === "week" ? <WeekView /> : (
          <div>
            {/* Day macro bar */}
            <div style={{ ...cardStyle, marginBottom:12 }}>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", borderBottom:"1px solid "+rule }}>
                {[{label:"Protein",val:tots.protein,tgt:targets.protein,color:blue},{label:"Carbs",val:tots.carbs,tgt:targets.carbs,color:teal},{label:"Fat",val:tots.fat,tgt:targets.fat,color:gold},{label:"Calories",val:tots.calories,tgt:targets.calories,color:terra}].map((m,i) => (
                  <div key={m.label} style={{ padding:"10px 12px", textAlign:"center", borderRight:i<3?"1px solid "+rule:"none" }}>
                    <div style={{ fontSize:9, color:mid, textTransform:"uppercase", marginBottom:3 }}>{m.label}</div>
                    <div style={{ fontSize:16, fontWeight:700, color:m.color }}>{Math.round(m.val)}{m.label!=="Calories"?"g":""}</div>
                    <div style={{ background:rule, borderRadius:2, height:4, overflow:"hidden", margin:"4px 0" }}><div style={mbar(m.tgt>0?(m.val/m.tgt)*100:0,m.color)} /></div>
                    <div style={{ fontSize:9, color:light }}>/ {m.tgt}{m.label!=="Calories"?"g":""}</div>
                  </div>
                ))}
              </div>
            </div>
            {/* Meal cards */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
              {SLOTS.filter(sl => withDessert || sl !== "dessert").map(slot => (
                <MealCard key={slot} meal={plan[selDay] && plan[selDay][slot]} day={selDay} slot={slot} />
              ))}
            </div>
            {/* Pinned meals for this day info */}
            {pinned[selDay] && Object.keys(pinned[selDay]).length > 0 && (
              <div style={{ ...cardStyle, marginTop:12 }}>
                <div style={{ padding:"9px 14px", borderBottom:"1px solid "+rule }}>
                  <div style={h3Style}>📌 Pinned for {selDay}</div>
                </div>
                <div style={{ padding:"9px 14px", display:"flex", gap:6, flexWrap:"wrap" }}>
                  {Object.entries(pinned[selDay]).map(([slot, recipe]) => (
                    <div key={slot} style={{ background:goldL, border:"1px solid "+goldM, borderRadius:8, padding:"5px 10px", display:"flex", alignItems:"center", gap:6 }}>
                      <span style={{ fontSize:10, color:gold, fontWeight:700, textTransform:"uppercase" }}>{slot}</span>
                      <span style={{ fontSize:11, color:charcoal, fontWeight:600 }}>{recipe.name}</span>
                      <button onClick={() => clearPin(selDay, slot)} style={{ ...btn(goldL,gold,true), fontSize:9, padding:"1px 5px" }}>✕</button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // ── SHOP TAB ──────────────────────────────────────────────────────────────
  function ShopTab() {
    const CAT_LABELS = { produce:"🥬 Produce", protein:"🥩 Meat & Fish", dairy:"🥛 Dairy", pantry:"🫙 Pantry", frozen:"🧊 Frozen", bakery:"🍞 Bakery", deli:"🧀 Deli", other:"🛒 Other" };
    const checked = Object.values(shopList).filter(i => i.checked).length;
    const total   = Object.values(shopList).length;
    const byCat   = {};
    Object.entries(shopList).forEach(([k,v]) => { const c = v.cat||"other"; if(!byCat[c]) byCat[c]=[]; byCat[c].push({key:k,...v}); });
    return (
      <div>
        <div style={{ display:"flex", gap:10, marginBottom:12, flexWrap:"wrap", alignItems:"center" }}>
          <div style={{ fontFamily:"Georgia,serif", fontSize:15, fontWeight:600 }}>Shopping List</div>
          <span style={{ ...pill(sageL,sage), fontSize:12, padding:"3px 10px" }}>{checked}/{total}</span>
        </div>
        <div style={{ background:rule, borderRadius:3, height:5, marginBottom:14, overflow:"hidden" }}>
          <div style={mbar(total>0?(checked/total)*100:0, sage)} />
        </div>
        <div style={{ display:"flex", gap:8, marginBottom:14 }}>
          <input style={{ ...inpStyle, flex:1 }} placeholder="Add item…" value={adHoc} onChange={e => setAdHoc(e.target.value)} onKeyDown={e => { if(e.key==="Enter"&&adHoc.trim()){const k=adHoc.toLowerCase().trim();setShopList(l=>({...l,[k]:{name:adHoc.trim(),qty:null,unit:null,cat:"other",checked:false,adHoc:true}}));setAdHoc("");}}} />
          <button onClick={() => { if(!adHoc.trim())return;const k=adHoc.toLowerCase().trim();setShopList(l=>({...l,[k]:{name:adHoc.trim(),qty:null,unit:null,cat:"other",checked:false,adHoc:true}}));setAdHoc(""); }} style={btn(sage,"#fff")}>+ Add</button>
        </div>
        {Object.entries(CAT_LABELS).map(([cat,label]) => {
          const items = byCat[cat];
          if (!items || !items.length) return null;
          return (
            <div key={cat} style={{ ...cardStyle, marginBottom:10 }}>
              <div style={{ padding:"9px 14px", borderBottom:"1px solid "+rule, fontWeight:700, fontSize:12 }}>{label}</div>
              {items.map(item => (
                <div key={item.key} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 14px", borderBottom:"1px solid "+rule, background:item.checked?sageXL:cardBg }}>
                  <input type="checkbox" checked={item.checked} onChange={() => setShopList(l => ({...l,[item.key]:{...l[item.key],checked:!l[item.key].checked}}))} style={{ flexShrink:0 }} />
                  <span style={{ fontSize:13, fontWeight:500, textDecoration:item.checked?"line-through":"none", color:item.checked?light:charcoal, flex:1 }}>
                    {item.name}
                    {item.qty && <span style={{ fontWeight:400, color:mid, fontSize:11 }}> — {Math.round(item.qty)}{item.unit}</span>}
                    {item.adHoc && <span style={{ ...tag(blue,blueL), marginLeft:6 }}>custom</span>}
                  </span>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    );
  }

  // ── SETTINGS TAB ──────────────────────────────────────────────────────────
  function SettingsTab() {
    const [lt, setLt] = useState(targets);
    const [lp, setLp] = useState(prefs);
    const [le, setLe] = useState(equipment);
    const [saved, setSaved] = useState(false);
    function save() { setTargets(lt); setPrefs(lp); setEquipment(le); setSaved(true); setTimeout(() => setSaved(false), 2500); }
    return (
      <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
        <div style={{ ...cardStyle, background:"#1a1a18", color:"#e0e0e0", padding:"14px 16px", borderRadius:12 }}>
          <div style={{ fontFamily:"Georgia,serif", fontSize:13, fontWeight:600, color:"#7a9e7e", marginBottom:3 }}>⚠ Data saved locally</div>
          <div style={{ fontSize:11, color:"#888" }}>Connect Supabase + Google OAuth to sync across devices.</div>
        </div>
        <div style={cardStyle}>
          <div style={{ padding:"12px 16px", borderBottom:"1px solid "+rule, fontFamily:"Georgia,serif", fontSize:15, fontWeight:600 }}>🎯 Nutrition Targets</div>
          <div style={{ padding:"14px 16px", display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
            {[{key:"calories",label:"Calories (kcal)",color:terra},{key:"protein",label:"Protein (g)",color:blue},{key:"carbs",label:"Carbs (g)",color:teal},{key:"fat",label:"Fat (g)",color:gold}].map(f => (
              <div key={f.key}>
                <label style={{ fontSize:11, fontWeight:600, color:f.color, display:"block", marginBottom:4 }}>{f.label}</label>
                <input type="number" min="0" style={{ ...inpStyle, borderColor:f.color }} value={lt[f.key]} onChange={e => setLt(t => ({...t,[f.key]:Number(e.target.value)}))} />
              </div>
            ))}
          </div>
        </div>
        <div style={cardStyle}>
          <div style={{ padding:"12px 16px", borderBottom:"1px solid "+rule, fontFamily:"Georgia,serif", fontSize:15, fontWeight:600 }}>🍽 Cuisine Preferences</div>
          <div style={{ padding:"12px 16px", display:"flex", gap:6, flexWrap:"wrap" }}>
            {CUISINES.map(c => { const sel=lp.cuisines.includes(c); return <button key={c} onClick={() => setLp(p => ({...p,cuisines:sel?p.cuisines.filter(x=>x!==c):[...p.cuisines,c]}))} style={{ ...btn(sel?sage:surfaceBg,sel?"#fff":mid,true), border:"1px solid "+(sel?sage:rule) }}>{c}</button>; })}
          </div>
        </div>
        <div style={cardStyle}>
          <div style={{ padding:"12px 16px", borderBottom:"1px solid "+rule, fontFamily:"Georgia,serif", fontSize:15, fontWeight:600 }}>🌿 Dietary Requirements</div>
          <div style={{ padding:"12px 16px", display:"flex", gap:6, flexWrap:"wrap" }}>
            {DIETS.map(d => <button key={d} onClick={() => setLp(p => ({...p,diet:d}))} style={{ ...btn(lp.diet===d?teal:surfaceBg,lp.diet===d?"#fff":mid,true), border:"1px solid "+(lp.diet===d?teal:rule) }}>{d}</button>)}
          </div>
        </div>
        <div style={cardStyle}>
          <div style={{ padding:"12px 16px", borderBottom:"1px solid "+rule }}>
            <div style={{ fontFamily:"Georgia,serif", fontSize:15, fontWeight:600 }}>🔧 Kitchen Equipment</div>
            <div style={{ fontSize:11, color:mid }}>Deselect what you don't own</div>
          </div>
          <div style={{ padding:"12px 16px", display:"flex", gap:6, flexWrap:"wrap" }}>
            {EQUIP.map(eq => { const has=le.includes(eq); return <button key={eq} onClick={() => setLe(e => has?e.filter(x=>x!==eq):[...e,eq])} style={{ ...btn(has?plumL:surfaceBg,has?plum:light,true), border:"1px solid "+(has?plum:rule), textDecoration:has?"none":"line-through" }}>{eq}</button>; })}
          </div>
        </div>
        <div style={cardStyle}>
          <div style={{ padding:"12px 16px", borderBottom:"1px solid "+rule, fontFamily:"Georgia,serif", fontSize:15, fontWeight:600 }}>🚫 Exclude Ingredients</div>
          <div style={{ padding:"12px 16px" }}>
            <textarea style={{ ...inpStyle, minHeight:55, resize:"vertical" }} placeholder="e.g. peanuts, shellfish (comma-separated)" defaultValue={(lp.exclude||[]).join(", ")} onChange={e => setLp(p => ({...p,exclude:e.target.value.split(",").map(x=>x.trim()).filter(Boolean)}))} />
          </div>
        </div>
        <button onClick={save} style={{ ...btn(saved?teal:sage,"#fff"), padding:"11px", fontSize:14, borderRadius:10 }}>
          {saved ? "✓ Saved — regenerate plan to apply" : "Save Preferences"}
        </button>
      </div>
    );
  }

  // ── WEEKLY SUMMARY ────────────────────────────────────────────────────────
  function WeeklySummaryModal() {
    if (!showSum || !plan) return null;
    const ws = weeklyStats();
    const macroMeta = [{k:"protein",label:"Protein",col:blue,tgt:targets.protein},{k:"carbs",label:"Carbs",col:teal,tgt:targets.carbs},{k:"fat",label:"Fat",col:gold,tgt:targets.fat},{k:"calories",label:"Calories",col:terra,tgt:targets.calories}];
    const otCol = ws.daysOT>=5?teal:ws.daysOT>=3?gold:terra;
    const otBg  = ws.daysOT>=5?tealL:ws.daysOT>=3?goldL:terraL;
    const otLabel = ws.daysOT>=5?"🎯 Great week!":ws.daysOT>=3?"👍 On track":"⚠ Room to improve";
    return (
      <div style={overlayStyle} onClick={e => { if(e.target===e.currentTarget) setShowSum(false); }}>
        <div style={drawerStyle}>
          <DrawerHandle />
          <div style={{ padding:"14px 18px 12px", borderBottom:"1px solid "+rule, display:"flex", justifyContent:"space-between", alignItems:"center", flexShrink:0 }}>
            <div style={{ fontFamily:"Georgia,serif", fontSize:15, fontWeight:600 }}>📊 Weekly Summary</div>
            <button onClick={() => setShowSum(false)} style={{ ...btn(surfaceBg,mid), border:"1px solid "+rule, borderRadius:50, padding:"5px 10px" }}>✕</button>
          </div>
          <div style={{ overflowY:"auto", flex:1, padding:"16px 18px 28px" }}>
            <div style={{ background:otBg, border:"1px solid "+otCol, borderRadius:10, padding:"12px 16px", marginBottom:16, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div>
                <div style={{ fontWeight:700, fontSize:13, color:otCol }}>{otLabel}</div>
                <div style={{ fontSize:11, color:mid, marginTop:2 }}>{ws.daysOT} of 7 days within 15% of calorie target</div>
              </div>
              <div style={{ fontSize:28, fontWeight:700, color:otCol }}>{ws.daysOT}/7</div>
            </div>
            <div style={{ ...h3Style, marginBottom:8 }}>Daily Average vs Target</div>
            <div style={{ ...cardStyle, marginBottom:16 }}>
              {macroMeta.map((m,i) => {
                const pct = m.tgt>0?(ws.avg[m.k]/m.tgt)*100:0;
                const bCol = pct>110?terra:pct>90?teal:gold;
                const bBg  = pct>110?terraL:pct>90?tealL:goldL;
                return (
                  <div key={m.k} style={{ padding:"12px 16px", borderBottom:i<3?"1px solid "+rule:"none" }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
                      <span style={{ fontWeight:600, fontSize:13 }}>{m.label}</span>
                      <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                        <span style={{ fontSize:12, color:mid }}>avg <strong style={{color:m.col}}>{ws.avg[m.k]}{m.k!=="calories"?"g":""}</strong> / {m.tgt}{m.k!=="calories"?"g":""}</span>
                        <span style={{ ...pill(bBg,bCol), fontSize:10 }}>{Math.round(pct)}%</span>
                      </div>
                    </div>
                    <div style={{ background:rule, borderRadius:3, height:7, overflow:"hidden" }}><div style={{ ...mbar(pct,m.col), height:7 }} /></div>
                  </div>
                );
              })}
            </div>
            <div style={{ ...h3Style, marginBottom:8 }}>Day-by-Day</div>
            <div style={cardStyle}>
              <div style={{ display:"grid", gridTemplateColumns:"80px repeat(4,1fr)", background:surfaceBg, padding:"8px 12px", borderBottom:"1px solid "+rule }}>
                {["Day","Protein","Carbs","Fat","Calories"].map(h => <span key={h} style={{ fontSize:10, fontWeight:700, color:mid, textAlign:h!=="Day"?"center":"left" }}>{h}</span>)}
              </div>
              {DAYS.map((day,i) => {
                const t = ws.days[i];
                const ok = Math.abs(t.calories-targets.calories)/(targets.calories||1) < 0.15;
                const calCol = t.calories>targets.calories*1.15?terra:t.calories<targets.calories*0.85?gold:teal;
                return (
                  <div key={day} style={{ display:"grid", gridTemplateColumns:"80px repeat(4,1fr)", padding:"8px 12px", borderBottom:i<6?"1px solid "+rule:"none", background:ok?sageXL:cardBg, alignItems:"center" }}>
                    <span style={{ fontSize:12, fontWeight:600, color:ok?sage:charcoal }}>{day.slice(0,3)}{ok?" ✓":""}</span>
                    <span style={{ fontSize:12, color:blue,   textAlign:"center", fontWeight:500 }}>{t.protein}g</span>
                    <span style={{ fontSize:12, color:teal,   textAlign:"center", fontWeight:500 }}>{t.carbs}g</span>
                    <span style={{ fontSize:12, color:gold,   textAlign:"center", fontWeight:500 }}>{t.fat}g</span>
                    <span style={{ fontSize:12, color:calCol, textAlign:"center", fontWeight:700 }}>{t.calories}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── HISTORY MODAL ─────────────────────────────────────────────────────────
  function HistoryModal() {
    if (!showHist) return null;
    const grouped = {};
    history.forEach(h => { const d=h.date.split("T")[0]; if(!grouped[d]) grouped[d]=[]; grouped[d].push(h); });
    return (
      <div style={overlayStyle} onClick={e => { if(e.target===e.currentTarget) setShowHist(false); }}>
        <div style={drawerStyle}>
          <DrawerHandle />
          <div style={{ padding:"14px 18px 12px", borderBottom:"1px solid "+rule, display:"flex", justifyContent:"space-between", alignItems:"center", flexShrink:0 }}>
            <div style={{ fontFamily:"Georgia,serif", fontSize:15, fontWeight:600 }}>📖 Meal History</div>
            <button onClick={() => setShowHist(false)} style={{ ...btn(surfaceBg,mid), border:"1px solid "+rule, borderRadius:50, padding:"5px 10px" }}>✕</button>
          </div>
          <div style={{ overflowY:"auto", flex:1, padding:"14px 18px 24px" }}>
            {history.length === 0 && <div style={{ textAlign:"center", padding:"40px 0", color:light }}><div style={{ fontSize:32, marginBottom:8 }}>📓</div><div>No meals logged yet.</div></div>}
            {Object.entries(grouped).sort((a,b) => b[0].localeCompare(a[0])).map(([date,entries]) => (
              <div key={date} style={{ marginBottom:18 }}>
                <div style={{ ...h3Style, marginBottom:8 }}>{new Date(date+"T00:00:00").toLocaleDateString("en-AU",{weekday:"long",day:"numeric",month:"long"})}</div>
                {entries.map((h,i) => (
                  <div key={i} style={{ ...cardStyle, marginBottom:8, padding:"11px 14px" }}>
                    <div style={{ display:"flex", gap:5, marginBottom:4 }}><span style={tag(SLOT_COLORS[h.slot]||mid,SLOT_BG[h.slot]||surfaceBg)}>{h.slot}</span>{h.wouldMakeAgain&&<span style={tag(teal,tealL)}>♥ Again</span>}</div>
                    <div style={{ fontFamily:"Georgia,serif", fontSize:14, fontWeight:600, marginBottom:4 }}>{h.recipeName}</div>
                    {h.rating>0&&<div style={{ color:"#F4B400", fontSize:14 }}>{"★".repeat(h.rating)}{"☆".repeat(5-h.rating)}</div>}
                    {h.comment&&<div style={{ fontSize:11, color:mid, marginTop:4, fontStyle:"italic" }}>"{h.comment}"</div>}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── LIBRARY MODAL ─────────────────────────────────────────────────────────
  function LibraryModal() {
    if (!showLib) return null;
    const filtered = allRecipes.filter(r => {
      if (libFilter==="custom"  && r.source==="builtin") return false;
      if (libFilter==="builtin" && r.source!=="builtin") return false;
      if (libSearch && !r.name.toLowerCase().includes(libSearch.toLowerCase())) return false;
      return true;
    });
    return (
      <div style={overlayStyle} onClick={e => { if(e.target===e.currentTarget) setShowLib(false); }}>
        <div style={{ ...drawerStyle, maxWidth:720 }}>
          <DrawerHandle />
          <div style={{ padding:"14px 18px 12px", borderBottom:"1px solid "+rule, flexShrink:0 }}>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:10 }}>
              <div style={{ fontFamily:"Georgia,serif", fontSize:15, fontWeight:600 }}>📚 Recipe Library ({allRecipes.length})</div>
              <div style={{ display:"flex", gap:8 }}>
                <button onClick={() => setShowUrl(true)} style={btn(sageXL,sage)}>🔗 Import</button>
                <button onClick={openNewRecipe}          style={btn(sage,"#fff")}>+ Add</button>
                <button onClick={() => setShowLib(false)} style={{ ...btn(surfaceBg,mid), border:"1px solid "+rule, borderRadius:50, padding:"5px 10px" }}>✕</button>
              </div>
            </div>
            <div style={{ display:"flex", gap:8 }}>
              <input style={{ ...inpStyle, flex:1 }} placeholder="Search…" value={libSearch} onChange={e => setLibSearch(e.target.value)} />
              {["all","builtin","custom"].map(f => <button key={f} onClick={() => setLibFilter(f)} style={navBtn(libFilter===f)}>{f==="all"?"All":f==="builtin"?"Built-in":"Mine"}</button>)}
            </div>
          </div>
          <div style={{ overflowY:"auto", flex:1, padding:"12px 18px 20px", display:"flex", flexDirection:"column", gap:8 }}>
            {filtered.map(r => (
              <div key={r.id} style={{ ...cardStyle, padding:"11px 14px", display:"flex", gap:12, alignItems:"flex-start" }}>
                <div style={{ flex:1 }}>
                  <div style={{ display:"flex", gap:5, marginBottom:3, flexWrap:"wrap" }}>
                    <span style={tag(SLOT_COLORS[r.slot],SLOT_BG[r.slot])}>{r.slot}</span>
                    {r.source!=="builtin"&&<span style={tag(plum,plumL)}>Mine</span>}
                  </div>
                  <div style={{ fontFamily:"Georgia,serif", fontSize:14, fontWeight:600, marginBottom:2 }}>{r.name}</div>
                  <div style={{ fontSize:11, color:mid }}>⏱ {r.totalTime}min · {r.ingredients&&r.ingredients.length} ingredients</div>
                  <div style={{ display:"flex", gap:5, marginTop:5 }}>
                    <span style={pill(blueL,blue)}>P {r.macros&&r.macros.protein}g</span>
                    <span style={pill("#e8f4e8",teal)}>C {r.macros&&r.macros.carbs}g</span>
                    <span style={pill(goldL,gold)}>F {r.macros&&r.macros.fat}g</span>
                    <span style={pill(terraL,terra)}>{r.macros&&r.macros.calories} cal</span>
                  </div>
                </div>
                <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
                  <button onClick={() => { setOpenMeal({meal:r,day:selDay,slot:r.slot}); setShowLib(false); }} style={btn(sageXL,sage,true)}>View</button>
                  {r.source!=="builtin"&&<>
                    <button onClick={() => openEditRecipe(r)} style={btn(surfaceBg,mid,true)}>Edit</button>
                    <button onClick={() => { if(window.confirm("Delete "+r.name+"?")) setCustom(c=>c.filter(x=>x.id!==r.id)); }} style={btn(terraL,terra,true)}>Delete</button>
                  </>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── EDITOR MODAL ──────────────────────────────────────────────────────────
  function EditorModal() {
    if (!showEdit || !draft) return null;
    const d = draft;
    return (
      <div style={overlayStyle} onClick={e => { if(e.target===e.currentTarget) setShowEdit(false); }}>
        <div style={{ ...drawerStyle, maxWidth:720 }}>
          <DrawerHandle />
          <div style={{ padding:"14px 18px 12px", borderBottom:"1px solid "+rule, display:"flex", justifyContent:"space-between", alignItems:"center", flexShrink:0 }}>
            <div style={{ fontFamily:"Georgia,serif", fontSize:15, fontWeight:600 }}>{editId?"✏️ Edit Recipe":"✏️ Add Recipe"}</div>
            <button onClick={() => setShowEdit(false)} style={{ ...btn(surfaceBg,mid), border:"1px solid "+rule, borderRadius:50, padding:"5px 10px" }}>✕</button>
          </div>
          <div style={{ overflowY:"auto", flex:1, padding:"16px 18px 24px", display:"flex", flexDirection:"column", gap:14 }}>
            <div><div style={h3Style}>Name *</div><input style={inpStyle} value={d.name} onChange={e => setDraftField("name",e.target.value)} placeholder="Recipe name" /></div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:10 }}>
              <div><div style={{ ...h3Style, marginBottom:4 }}>Meal Type</div><select style={{ ...selStyle, width:"100%" }} value={d.slot} onChange={e => setDraftField("slot",e.target.value)}>{SLOTS.map(sl=><option key={sl} value={sl}>{sl}</option>)}</select></div>
              <div><div style={{ ...h3Style, marginBottom:4 }}>Prep (min)</div><input type="number" style={inpStyle} value={d.prepTime} onChange={e => setDraftField("prepTime",parseInt(e.target.value)||0)} /></div>
              <div><div style={{ ...h3Style, marginBottom:4 }}>Cook (min)</div><input type="number" style={inpStyle} value={d.cookTime} onChange={e => setDraftField("cookTime",parseInt(e.target.value)||0)} /></div>
              <div><div style={{ ...h3Style, marginBottom:4 }}>Serves</div><input type="number" style={inpStyle} min={1} value={d.baseServings} onChange={e => setDraftField("baseServings",parseInt(e.target.value)||1)} /></div>
            </div>
            <div><div style={h3Style}>Cuisine</div><div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>{CUISINES.map(c => { const sel=d.cuisine.includes(c); return <button key={c} onClick={() => toggleDraftArr("cuisine",c)} style={{ ...btn(sel?sage:surfaceBg,sel?"#fff":mid,true), border:"1px solid "+(sel?sage:rule) }}>{c}</button>; })}</div></div>
            <div><div style={h3Style}>Diet Tags</div><div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>{DIETS.filter(x=>x!=="None").map(dt => { const sel=d.diet.includes(dt); return <button key={dt} onClick={() => toggleDraftArr("diet",dt)} style={{ ...btn(sel?teal:surfaceBg,sel?"#fff":mid,true), border:"1px solid "+(sel?teal:rule) }}>{dt}</button>; })}</div></div>
            <div><div style={h3Style}>Equipment</div><div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>{EQUIP.map(eq => { const sel=d.equipment.includes(eq); return <button key={eq} onClick={() => toggleDraftArr("equipment",eq)} style={{ ...btn(sel?plum:surfaceBg,sel?"#fff":mid,true), border:"1px solid "+(sel?plum:rule) }}>{eq}</button>; })}</div></div>
            <div>
              <div style={h3Style}>Macros (per serving)</div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:10 }}>
                {[{k:"protein",label:"Protein g",col:blue},{k:"carbs",label:"Carbs g",col:teal},{k:"fat",label:"Fat g",col:gold},{k:"calories",label:"Calories",col:terra}].map(f => (
                  <div key={f.k}><div style={{ fontSize:10, fontWeight:600, color:f.col, marginBottom:3 }}>{f.label}</div><input type="number" min="0" style={{ ...inpStyle, borderColor:f.col }} value={d.macros[f.k]} onChange={e => setDraftMacro(f.k,e.target.value)} /></div>
                ))}
              </div>
              <div style={{ fontSize:10, color:mid, marginTop:4 }}>💡 Leave calories 0 to auto-calculate</div>
            </div>
            <div>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}><div style={h3Style}>Ingredients</div><button onClick={() => setDraft(d => ({...d,ingredients:[...d.ingredients,{name:"",qty:"",unit:"g",cat:"produce"}]}))} style={btn(sageXL,sage,true)}>+ Add</button></div>
              <div style={{ display:"flex", flexDirection:"column", gap:7 }}>
                {d.ingredients.map((ing,i) => (
                  <div key={i} style={{ display:"grid", gridTemplateColumns:"2fr 70px 80px 100px 26px", gap:6, alignItems:"center" }}>
                    <input style={inpStyle} placeholder="Ingredient" value={ing.name} onChange={e => setIngField(i,"name",e.target.value)} />
                    <input type="number" style={inpStyle} placeholder="Qty" value={ing.qty} onChange={e => setIngField(i,"qty",parseFloat(e.target.value)||"")} />
                    <select style={{ ...selStyle, width:"100%" }} value={ing.unit} onChange={e => setIngField(i,"unit",e.target.value)}>{["g","ml","kg","L","tsp","tbsp","cup","whole","slices","cloves","sheets","bunch","pinch"].map(u=><option key={u} value={u}>{u}</option>)}</select>
                    <select style={{ ...selStyle, width:"100%" }} value={ing.cat} onChange={e => setIngField(i,"cat",e.target.value)}>{["produce","protein","dairy","pantry","frozen","bakery","deli","other"].map(c=><option key={c} value={c}>{c}</option>)}</select>
                    <button onClick={() => setDraft(d => ({...d,ingredients:d.ingredients.filter((_,idx)=>idx!==i)}))} style={{ ...btn(terraL,terra,true), width:24, padding:"2px 0", textAlign:"center" }}>✕</button>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}><div style={h3Style}>Method</div><button onClick={() => setDraft(d => ({...d,steps:[...d.steps,""]}))} style={btn(sageXL,sage,true)}>+ Add Step</button></div>
              <div style={{ display:"flex", flexDirection:"column", gap:7 }}>
                {d.steps.map((step,i) => (
                  <div key={i} style={{ display:"flex", gap:8, alignItems:"flex-start" }}>
                    <div style={{ width:22, height:22, borderRadius:"50%", background:sageL, color:sage, fontSize:10, fontWeight:700, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, marginTop:6 }}>{i+1}</div>
                    <textarea style={{ ...inpStyle, flex:1, resize:"vertical", minHeight:38, fontSize:12 }} value={step} onChange={e => setDraft(d => { const steps=[...d.steps]; steps[i]=e.target.value; return {...d,steps}; })} />
                    <button onClick={() => setDraft(d => ({...d,steps:d.steps.filter((_,idx)=>idx!==i)}))} style={{ ...btn(terraL,terra,true), marginTop:4 }}>✕</button>
                  </div>
                ))}
              </div>
            </div>
            <div><div style={h3Style}>Chef's Tip</div><input style={inpStyle} placeholder="Optional tip…" value={d.tip} onChange={e => setDraftField("tip",e.target.value)} /></div>
            <div style={{ display:"flex", gap:10 }}>
              <button onClick={saveDraft} disabled={!d.name} style={{ ...btn(sage,"#fff"), padding:"10px 0", fontSize:13, borderRadius:10, flex:1, opacity:d.name?1:0.5 }}>{editId?"✓ Save Changes":"✓ Add to My Recipes"}</button>
              <button onClick={() => setShowEdit(false)} style={{ ...btn(surfaceBg,mid), padding:"10px 18px", border:"1px solid "+rule, borderRadius:10 }}>Cancel</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── URL IMPORT MODAL ──────────────────────────────────────────────────────
  function UrlModal() {
    if (!showUrl) return null;
    return (
      <div style={overlayStyle} onClick={e => { if(e.target===e.currentTarget) setShowUrl(false); }}>
        <div style={{ ...drawerStyle, maxWidth:600, maxHeight:"80vh" }}>
          <DrawerHandle />
          <div style={{ padding:"14px 18px 12px", borderBottom:"1px solid "+rule, display:"flex", justifyContent:"space-between", alignItems:"center", flexShrink:0 }}>
            <div><div style={{ fontFamily:"Georgia,serif", fontSize:15, fontWeight:600 }}>🔗 Import from URL</div><div style={{ fontSize:11, color:mid, marginTop:2 }}>Paste any recipe page link</div></div>
            <button onClick={() => setShowUrl(false)} style={{ ...btn(surfaceBg,mid), border:"1px solid "+rule, borderRadius:50, padding:"5px 10px" }}>✕</button>
          </div>
          <div style={{ overflowY:"auto", flex:1, padding:"16px 18px 24px" }}>
            <div style={{ display:"flex", gap:8, marginBottom:12 }}>
              <input style={{ ...inpStyle, flex:1 }} placeholder="https://www.taste.com.au/recipes/…" value={impUrl} onChange={e => setImpUrl(e.target.value)} onKeyDown={e => { if(e.key==="Enter") doImport(); }} />
              <button onClick={doImport} disabled={impStatus==="loading"||!impUrl.trim()} style={{ ...btn(sage,"#fff"), flexShrink:0, opacity:impUrl.trim()?1:0.5 }}>{impStatus==="loading"?"Parsing…":"Import"}</button>
            </div>
            <div style={{ background:sageXL, border:"1px solid "+sageL, borderRadius:8, padding:"9px 12px", fontSize:11, color:sage, marginBottom:12 }}>Works with: <strong>taste.com.au, delicious.com.au, sbs.com.au/food, nytcooking.com, bbcgoodfood.com, allrecipes.com</strong></div>
            {impStatus==="loading"&&<div style={{ textAlign:"center", padding:"30px 0", color:mid }}><div style={{ fontSize:28, marginBottom:8 }}>🧑‍🍳</div><div style={{ fontWeight:600 }}>Parsing recipe…</div></div>}
            {impStatus==="error"&&<div style={{ background:terraL, border:"1px solid "+terra, borderRadius:8, padding:"10px 14px", color:terra, marginBottom:12 }}><strong>⚠ Failed:</strong> {impErr}</div>}
            {impStatus==="success"&&impPrev&&(
              <div>
                <div style={{ ...cardStyle, marginBottom:12, padding:"12px 14px" }}>
                  <div style={{ fontFamily:"Georgia,serif", fontSize:16, fontWeight:600, marginBottom:4 }}>{impPrev.name}</div>
                  <div style={{ display:"flex", gap:5, marginBottom:8 }}><span style={tag(SLOT_COLORS[impPrev.slot],SLOT_BG[impPrev.slot])}>{impPrev.slot}</span></div>
                  <div style={{ display:"flex", gap:8, marginBottom:10 }}>
                    {[{l:"P",v:impPrev.macros&&impPrev.macros.protein,c:blue},{l:"C",v:impPrev.macros&&impPrev.macros.carbs,c:teal},{l:"F",v:impPrev.macros&&impPrev.macros.fat,c:gold},{l:"Cal",v:impPrev.macros&&impPrev.macros.calories,c:terra}].map(m => (
                      <div key={m.l} style={{ flex:1, background:surfaceBg, borderRadius:7, padding:"6px 8px", textAlign:"center" }}><div style={{ fontSize:9, color:mid }}>{m.l}</div><div style={{ fontSize:14, fontWeight:700, color:m.c }}>{m.v}</div></div>
                    ))}
                  </div>
                  <div style={{ border:"1px solid "+rule, borderRadius:7, overflow:"hidden" }}>
                    {impPrev.ingredients&&impPrev.ingredients.slice(0,5).map((ing,i) => (
                      <div key={i} style={{ display:"flex", justifyContent:"space-between", padding:"6px 10px", borderBottom:i<4?"1px solid "+rule:"none", background:i%2===0?sageXL:cardBg, fontSize:12 }}>
                        <span>{ing.name}</span><span style={{ fontWeight:600 }}>{ing.qty} {ing.unit}</span>
                      </div>
                    ))}
                    {impPrev.ingredients&&impPrev.ingredients.length>5&&<div style={{ padding:"6px 10px", fontSize:11, color:mid }}>+{impPrev.ingredients.length-5} more</div>}
                  </div>
                </div>
                <div style={{ display:"flex", gap:10 }}>
                  <button onClick={saveImport} style={{ ...btn(sage,"#fff"), padding:"10px 0", fontSize:13, borderRadius:10, flex:1 }}>✓ Save to My Recipes</button>
                  <button onClick={() => { setDraft({...impPrev}); setEditId(null); setShowEdit(true); setShowUrl(false); }} style={{ ...btn(sageXL,sage), padding:"10px 16px", borderRadius:10 }}>Edit First</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── ROOT ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ fontFamily:"'DM Sans',system-ui,sans-serif", background:pageBg, minHeight:"100vh", fontSize:14, color:charcoal }}>
      <div style={{ background:cardBg, borderBottom:"1px solid "+rule, padding:"0 18px", display:"flex", alignItems:"center", justifyContent:"space-between", height:54, position:"sticky", top:0, zIndex:200 }}>
        <div style={{ fontFamily:"Georgia,serif", fontSize:17, fontWeight:600, color:sage }}>Nutri<span style={{ color:terra }}>Plan</span></div>
        <nav style={{ display:"flex", gap:4 }}>
          {[["plan","📅 Plan"],["shop","🛒 Shop"],["settings","⚙️ Settings"]].map(([id,label]) => (
            <button key={id} onClick={() => setTab(id)} style={navBtn(tab===id)}>{label}</button>
          ))}
        </nav>
      </div>
      <div style={{ padding:"14px 18px", maxWidth:1100, margin:"0 auto" }}>
        {tab==="plan"     && <PlanTab />}
        {tab==="shop"     && <ShopTab />}
        {tab==="settings" && <SettingsTab />}
      </div>
      {openMeal  && <RecipeDrawer />}
      {showSum   && <WeeklySummaryModal />}
      {showHist  && <HistoryModal />}
      {showLib   && <LibraryModal />}
      {showEdit  && <EditorModal />}
      {showUrl   && <UrlModal />}
      {pickerOpen && <MealPickerModal />}
    </div>
  );
}
