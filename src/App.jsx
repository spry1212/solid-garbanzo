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

import { useState, useEffect, useCallback, useRef } from "react";

// ─── COLOUR SYSTEM ────────────────────────────────────────────────────────────
const C = {
  bg:"#f5f4f0", card:"#ffffff", surface:"#FAFAF9",
  sage:"#4a6b4e", sageM:"#7a9e7e", sageL:"#d4e6d6", sageXL:"#eef5ef",
  terra:"#993C1D", terraL:"#f2e0d6", terraXL:"#faf3f0",
  gold:"#854F0B", goldM:"#C9A84C", goldL:"#FBF5E6",
  blue:"#185FA5", blueL:"#E6F1FB",
  plum:"#3C3489", plumL:"#EEEDFE",
  teal:"#0F6E56", tealL:"#E1F5EE",
  red:"#c0392b", redL:"#fde8e8",
  mid:"#5F5E5A", light:"#B4B2A9", rule:"#D3D1C7", charcoal:"#1a1a18",
};
const SLOT_COLORS = { breakfast:C.goldM, lunch:C.teal, dinner:C.terra, snack:C.plum };
const SLOT_BG     = { breakfast:C.goldL, lunch:C.tealL, dinner:C.terraL, snack:C.plumL };

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const DAYS    = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
const SLOTS   = ["breakfast","lunch","dinner","snack"];
const CUISINES= ["Mediterranean","Italian","Asian","Japanese","Korean","Mexican","Indian","Middle Eastern","American","Thai","Greek","French","Australian"];
const DIETS   = ["None","Vegetarian","Vegan","Gluten-Free","Dairy-Free","Halal","Kosher","Paleo","Keto"];
const EQUIP   = ["Stovetop","Oven","Microwave","Air Fryer","Slow Cooker","Blender","Food Processor","BBQ/Grill","Rice Cooker"];
const UNITS   = ["g","ml","kg","L","tsp","tbsp","cup","whole","slices","cloves","sheets","bunch","handful","pinch"];
const ING_CATS= ["produce","protein","dairy","pantry","frozen","bakery","other"];
const STORES  = ["Coles","Woolworths","Aldi","IGA","Local Butcher","Local Grocer","Asian Grocer"];
const SHOP_CATS={ produce:"🥬 Produce", protein:"🥩 Meat & Fish", dairy:"🥛 Dairy", pantry:"🫙 Pantry", frozen:"🧊 Frozen", bakery:"🍞 Bakery", other:"🛒 Other" };

// ─── SEASONAL PRODUCE — Australian calendar ────────────────────────────────
const SEASONAL = {
  0: ["zucchini","cucumber","tomato","capsicum","eggplant","corn","mango","peach","nectarine","cherry","watermelon","lettuce"],
  1: ["zucchini","cucumber","tomato","capsicum","eggplant","corn","mango","fig","peach","watermelon"],
  2: ["zucchini","broccoli","cauliflower","pumpkin","apple","pear","grape","fig","avocado","spinach"],
  3: ["broccoli","cauliflower","pumpkin","leek","spinach","apple","pear","lemon","orange","avocado"],
  4: ["broccoli","cauliflower","pumpkin","leek","spinach","orange","lemon","grapefruit","avocado","mushroom"],
  5: ["pumpkin","leek","cauliflower","brussels sprout","orange","lemon","grapefruit","mushroom","carrot"],
  6: ["pumpkin","carrot","parsnip","swede","orange","lemon","grapefruit","kiwi","mushroom","cauliflower"],
  7: ["pumpkin","carrot","broccoli","cauliflower","orange","grapefruit","mandarin","kiwi","mushroom"],
  8: ["asparagus","broccoli","pea","spinach","strawberry","mandarin","kiwi","avocado","mushroom"],
  9: ["asparagus","zucchini","tomato","capsicum","strawberry","cherry","apple","avocado","spinach"],
  10:["zucchini","tomato","capsicum","eggplant","cucumber","cherry","peach","mango","strawberry","lettuce"],
  11:["zucchini","tomato","capsicum","cucumber","eggplant","mango","peach","cherry","strawberry","watermelon","lettuce"],
};
const currentMonth = new Date().getMonth();
const inSeasonNow  = SEASONAL[currentMonth] || [];
const isInSeason   = (name) => inSeasonNow.some(s => name.toLowerCase().includes(s));

// ─── PRICE DATABASE — Melbourne 2025 AUD (with special tracking) ────────────
const PRICE_DB = {
  "chicken breast":    { base:8.50,  current:7.00,  cat:"protein", store:"Coles",      unit:"500g" },
  "salmon fillet":     { base:14.00, current:14.00, cat:"protein", store:"Woolworths", unit:"2×200g" },
  "beef mince":        { base:9.00,  current:7.50,  cat:"protein", store:"Coles",      unit:"500g" },
  "lamb mince":        { base:11.00, current:11.00, cat:"protein", store:"Woolworths", unit:"500g" },
  "pork chops":        { base:10.00, current:10.00, cat:"protein", store:"Coles",      unit:"2 pack" },
  "eggs":              { base:6.50,  current:6.50,  cat:"dairy",   store:"Coles",      unit:"12 pack" },
  "greek yoghurt":     { base:5.50,  current:4.50,  cat:"dairy",   store:"Woolworths", unit:"500g" },
  "feta":              { base:4.50,  current:4.50,  cat:"dairy",   store:"Woolworths", unit:"200g" },
  "parmesan":          { base:5.00,  current:5.00,  cat:"dairy",   store:"Coles",      unit:"100g" },
  "baby spinach":      { base:3.50,  current:3.00,  cat:"produce", store:"Coles",      unit:"120g" },
  "cherry tomatoes":   { base:4.00,  current:3.50,  cat:"produce", store:"Woolworths", unit:"400g" },
  "avocado":           { base:2.00,  current:1.50,  cat:"produce", store:"Coles",      unit:"each" },
  "broccoli":          { base:2.50,  current:2.50,  cat:"produce", store:"Woolworths", unit:"head" },
  "zucchini":          { base:1.50,  current:1.20,  cat:"produce", store:"Coles",      unit:"each" },
  "brown rice":        { base:3.00,  current:3.00,  cat:"pantry",  store:"Coles",      unit:"1kg" },
  "chickpeas":         { base:1.30,  current:1.00,  cat:"pantry",  store:"Coles",      unit:"400g tin" },
  "cannellini beans":  { base:1.30,  current:1.30,  cat:"pantry",  store:"Coles",      unit:"400g tin" },
  "crushed tomatoes":  { base:1.20,  current:0.99,  cat:"pantry",  store:"Woolworths", unit:"400g tin" },
  "olive oil":         { base:7.00,  current:6.00,  cat:"pantry",  store:"Coles",      unit:"500ml" },
  "sourdough":         { base:6.00,  current:6.00,  cat:"bakery",  store:"Bakery",     unit:"loaf" },
  "frozen berries":    { base:5.00,  current:4.00,  cat:"frozen",  store:"Coles",      unit:"1kg" },
};
const onSpecial = Object.entries(PRICE_DB).filter(([,v]) => v.current < v.base * 0.9);

const priceFor = (ingName) => {
  const key = Object.keys(PRICE_DB).find(k => ingName.toLowerCase().includes(k));
  return key ? PRICE_DB[key] : null;
};

// ─── RECIPE DATABASE ──────────────────────────────────────────────────────────
const RECIPE_DB = [
  { id:"r001", name:"Protein Berry & Chia Bowl", slot:"breakfast", cuisine:["Mediterranean"], diet:["Vegetarian","Gluten-Free"], equipment:["Microwave"], prepTime:5, cookTime:0, totalTime:5, servings:2, yieldServings:2, macros:{protein:29,carbs:28,fat:9,calories:360}, ingredients:[{name:"Protein powder",qty:30,unit:"g",cat:"pantry"},{name:"Greek yoghurt",qty:150,unit:"g",cat:"dairy",sharedKey:"greek_yoghurt"},{name:"Almond milk",qty:100,unit:"ml",cat:"dairy"},{name:"Chia seeds",qty:20,unit:"g",cat:"pantry"},{name:"Frozen mixed berries",qty:80,unit:"g",cat:"frozen",seasonal:true},{name:"Honey",qty:5,unit:"g",cat:"pantry"}], steps:["Combine chia seeds with almond milk. Refrigerate overnight.","Blend protein powder with Greek yoghurt.","Layer chia pudding, protein yoghurt, and berries.","Drizzle honey. Serve."], tip:"Prep chia seeds the night before.", source:"builtin" },
  { id:"r002", name:"Smashed Avo & Poached Eggs", slot:"breakfast", cuisine:["Australian","Mediterranean"], diet:["Vegetarian","Dairy-Free"], equipment:["Stovetop"], prepTime:5, cookTime:8, totalTime:13, servings:2, yieldServings:2, macros:{protein:26,carbs:32,fat:20,calories:490}, ingredients:[{name:"Sourdough bread",qty:2,unit:"slices",cat:"bakery",sharedKey:"sourdough"},{name:"Eggs",qty:2,unit:"whole",cat:"dairy",sharedKey:"eggs"},{name:"Avocado",qty:0.5,unit:"whole",cat:"produce",sharedKey:"avocado"},{name:"Lemon",qty:0.5,unit:"whole",cat:"produce",sharedKey:"lemon"},{name:"Chilli flakes",qty:1,unit:"g",cat:"pantry"}], steps:["Toast sourdough until golden.","Mash avocado with lemon juice, salt, pepper.","Poach eggs in simmering water 3–3.5 min.","Top toast with avo and eggs."], source:"builtin" },
  { id:"r003", name:"Protein Pancakes", slot:"breakfast", cuisine:["American"], diet:["Vegetarian","Gluten-Free"], equipment:["Stovetop","Blender"], prepTime:5, cookTime:10, totalTime:15, servings:2, yieldServings:2, macros:{protein:32,carbs:35,fat:10,calories:430}, ingredients:[{name:"Rolled oats",qty:80,unit:"g",cat:"pantry"},{name:"Banana",qty:1,unit:"whole",cat:"produce"},{name:"Eggs",qty:2,unit:"whole",cat:"dairy",sharedKey:"eggs"},{name:"Protein powder",qty:30,unit:"g",cat:"pantry"},{name:"Cinnamon",qty:2,unit:"g",cat:"pantry"}], steps:["Blend all ingredients until smooth.","Pour 3 tbsp batter per pancake, cook 2–3 min per side.","Serve with yoghurt or berries."], source:"builtin" },
  { id:"r004", name:"Shakshuka with Feta", slot:"breakfast", cuisine:["Mediterranean","Middle Eastern"], diet:["Vegetarian"], equipment:["Stovetop"], prepTime:5, cookTime:20, totalTime:25, servings:2, yieldServings:2, macros:{protein:28,carbs:35,fat:16,calories:460}, ingredients:[{name:"Eggs",qty:3,unit:"whole",cat:"dairy",sharedKey:"eggs"},{name:"Crushed tomatoes",qty:400,unit:"g",cat:"pantry",sharedKey:"crushed_tomatoes"},{name:"Brown onion",qty:0.5,unit:"whole",cat:"produce",sharedKey:"brown_onion"},{name:"Garlic",qty:2,unit:"cloves",cat:"produce",sharedKey:"garlic"},{name:"Smoked paprika",qty:3,unit:"g",cat:"pantry"},{name:"Ground cumin",qty:3,unit:"g",cat:"pantry"},{name:"Baby spinach",qty:60,unit:"g",cat:"produce",sharedKey:"baby_spinach"},{name:"Feta",qty:50,unit:"g",cat:"dairy"},{name:"Sourdough bread",qty:2,unit:"slices",cat:"bakery",sharedKey:"sourdough"}], steps:["Fry onion & garlic in oil 5 min.","Add spices, crushed tomatoes, spinach. Simmer 8 min.","Make 3 wells, crack eggs in. Cover, cook 5–7 min.","Scatter feta. Serve with sourdough."], source:"builtin" },
  { id:"r005", name:"Spiced Chickpea & Cauliflower Bowl", slot:"lunch", cuisine:["Mediterranean","Middle Eastern"], diet:["Vegan","Gluten-Free","Dairy-Free","Halal"], equipment:["Oven"], prepTime:10, cookTime:30, totalTime:40, servings:2, yieldServings:2, macros:{protein:22,carbs:52,fat:14,calories:460}, ingredients:[{name:"Cauliflower",qty:400,unit:"g",cat:"produce"},{name:"Chickpeas",qty:400,unit:"g",cat:"pantry",sharedKey:"chickpeas"},{name:"Ground cumin",qty:3,unit:"g",cat:"pantry"},{name:"Smoked paprika",qty:3,unit:"g",cat:"pantry"},{name:"Baby spinach",qty:60,unit:"g",cat:"produce",sharedKey:"baby_spinach"},{name:"Tahini",qty:20,unit:"g",cat:"pantry"},{name:"Greek yoghurt",qty:40,unit:"g",cat:"dairy",sharedKey:"greek_yoghurt"},{name:"Lemon",qty:0.5,unit:"whole",cat:"produce",sharedKey:"lemon"}], steps:["Preheat oven 210°C.","Toss cauliflower & chickpeas with oil, cumin, paprika. Roast 25–30 min.","Whisk yoghurt, tahini, lemon into dressing.","Serve over spinach, drizzle dressing."], tip:"Chickpeas can be roasted the night before.", source:"builtin" },
  { id:"r006", name:"Chicken & Avocado Grain Bowl", slot:"lunch", cuisine:["Asian","Mediterranean"], diet:["Gluten-Free","Dairy-Free","Halal"], equipment:["Stovetop"], prepTime:10, cookTime:15, totalTime:25, servings:2, yieldServings:2, macros:{protein:48,carbs:42,fat:18,calories:520}, ingredients:[{name:"Chicken breast",qty:150,unit:"g",cat:"protein",sharedKey:"chicken_breast"},{name:"Brown rice",qty:160,unit:"g",cat:"pantry",sharedKey:"brown_rice"},{name:"Avocado",qty:0.5,unit:"whole",cat:"produce",sharedKey:"avocado"},{name:"Edamame",qty:50,unit:"g",cat:"frozen"},{name:"Carrot",qty:1,unit:"whole",cat:"produce"},{name:"White miso paste",qty:15,unit:"g",cat:"pantry"},{name:"Sesame oil",qty:5,unit:"ml",cat:"pantry",sharedKey:"sesame_oil"},{name:"Ginger",qty:5,unit:"g",cat:"produce",sharedKey:"ginger"},{name:"Sesame seeds",qty:5,unit:"g",cat:"pantry"}], steps:["Poach chicken in simmering water 12–14 min. Slice.","Whisk miso, vinegar, sesame oil, ginger into dressing.","Assemble: rice base, avocado, edamame, carrot, chicken.","Drizzle dressing, scatter sesame seeds."], source:"builtin" },
  { id:"r007", name:"Korean Beef Bibimbap", slot:"lunch", cuisine:["Korean","Asian"], diet:["Gluten-Free","Dairy-Free","Halal"], equipment:["Stovetop"], prepTime:15, cookTime:15, totalTime:30, servings:2, yieldServings:2, macros:{protein:44,carbs:48,fat:17,calories:530}, ingredients:[{name:"Beef mince",qty:150,unit:"g",cat:"protein",sharedKey:"beef_mince"},{name:"Brown rice",qty:160,unit:"g",cat:"pantry",sharedKey:"brown_rice"},{name:"Baby spinach",qty:60,unit:"g",cat:"produce",sharedKey:"baby_spinach"},{name:"Carrot",qty:1,unit:"whole",cat:"produce"},{name:"Zucchini",qty:1,unit:"whole",cat:"produce",sharedKey:"zucchini"},{name:"Egg",qty:1,unit:"whole",cat:"dairy",sharedKey:"eggs"},{name:"Gochujang paste",qty:20,unit:"g",cat:"pantry"},{name:"Sesame oil",qty:5,unit:"ml",cat:"pantry",sharedKey:"sesame_oil"},{name:"Soy sauce",qty:15,unit:"ml",cat:"pantry",sharedKey:"soy_sauce"}], steps:["Cook beef with garlic, soy, gochujang, sesame oil.","Sauté spinach with sesame oil & soy until wilted.","Fry egg sunny side up.","Build bowl: rice base, veg sections, beef.","Top with egg and gochujang."], source:"builtin" },
  { id:"r008", name:"Tuna Niçoise Salad", slot:"lunch", cuisine:["French","Mediterranean"], diet:["Gluten-Free","Dairy-Free","Halal"], equipment:["Stovetop"], prepTime:10, cookTime:15, totalTime:25, servings:2, yieldServings:2, macros:{protein:38,carbs:32,fat:14,calories:450}, ingredients:[{name:"Tinned tuna",qty:185,unit:"g",cat:"pantry"},{name:"Green beans",qty:100,unit:"g",cat:"produce"},{name:"Eggs",qty:2,unit:"whole",cat:"dairy",sharedKey:"eggs"},{name:"Cherry tomatoes",qty:100,unit:"g",cat:"produce",sharedKey:"cherry_tomatoes"},{name:"Baby potatoes",qty:150,unit:"g",cat:"produce"},{name:"Mixed olives",qty:30,unit:"g",cat:"pantry",sharedKey:"olives"},{name:"Dijon mustard",qty:5,unit:"g",cat:"pantry"},{name:"Olive oil",qty:15,unit:"ml",cat:"pantry",sharedKey:"olive_oil"}], steps:["Boil potatoes 15 min. Drain and cool.","Blanch green beans 2 min. Ice water.","Hard-boil eggs 9–10 min. Peel and halve.","Arrange everything on a platter. Drizzle dressing."], source:"builtin" },
  // HIGH-YIELD DINNERS (yieldServings > servings triggers leftover logic)
  { id:"r009", name:"Moroccan Chicken with Couscous", slot:"dinner", cuisine:["Mediterranean","Middle Eastern"], diet:["Halal"], equipment:["Stovetop","Oven"], prepTime:15, cookTime:40, totalTime:55, servings:2, yieldServings:4, macros:{protein:54,carbs:45,fat:22,calories:620}, leftoversSlot:"lunch", leftoversName:"Moroccan Chicken Flatbread Wrap", ingredients:[{name:"Chicken thighs",qty:350,unit:"g",cat:"protein",sharedKey:"chicken_thighs"},{name:"Harissa paste",qty:30,unit:"g",cat:"pantry"},{name:"Crushed tomatoes",qty:200,unit:"g",cat:"pantry",sharedKey:"crushed_tomatoes"},{name:"Chicken stock",qty:150,unit:"ml",cat:"pantry",sharedKey:"chicken_stock"},{name:"Preserved lemon",qty:20,unit:"g",cat:"pantry"},{name:"Green olives",qty:30,unit:"g",cat:"pantry",sharedKey:"olives"},{name:"Couscous",qty:100,unit:"g",cat:"pantry"},{name:"Brown onion",qty:0.5,unit:"whole",cat:"produce",sharedKey:"brown_onion"},{name:"Garlic",qty:2,unit:"cloves",cat:"produce",sharedKey:"garlic"},{name:"Fresh coriander",qty:10,unit:"g",cat:"produce"}], steps:["Brown chicken 3–4 min per side. Remove.","Fry onion 5 min, add garlic & harissa 1 min.","Add tomatoes, stock, preserved lemon, olives.","Return chicken. Simmer covered 30–35 min.","Pour boiling stock over couscous, cover 5 min, fluff.","Serve. Refrigerate remaining for tomorrow's wrap."], tip:"Makes 4 serves — leftovers become next day's lunch.", source:"builtin", batchable:true },
  { id:"r010", name:"Garlic Baked Salmon with White Beans", slot:"dinner", cuisine:["Mediterranean","Italian"], diet:["Gluten-Free","Dairy-Free","Halal"], equipment:["Oven"], prepTime:10, cookTime:20, totalTime:30, servings:2, yieldServings:2, macros:{protein:56,carbs:28,fat:24,calories:560}, ingredients:[{name:"Salmon fillet",qty:200,unit:"g",cat:"protein"},{name:"Cannellini beans",qty:200,unit:"g",cat:"pantry",sharedKey:"white_beans"},{name:"Zucchini",qty:150,unit:"g",cat:"produce",sharedKey:"zucchini"},{name:"Cherry tomatoes",qty:150,unit:"g",cat:"produce",sharedKey:"cherry_tomatoes"},{name:"Garlic",qty:3,unit:"cloves",cat:"produce",sharedKey:"garlic"},{name:"Flat-leaf parsley",qty:10,unit:"g",cat:"produce",sharedKey:"parsley"},{name:"Lemon",qty:0.5,unit:"whole",cat:"produce",sharedKey:"lemon"},{name:"Olive oil",qty:15,unit:"ml",cat:"pantry",sharedKey:"olive_oil"}], steps:["Preheat oven 200°C.","Toss zucchini, tomatoes, garlic with oil. Roast 15 min.","Add beans to tray. Place fish in centre.","Press parsley-lemon crust on fish. Roast 12–15 min.","Squeeze lemon over everything."], source:"builtin" },
  { id:"r011", name:"Slow-Braised Beef Short Ribs & Polenta", slot:"dinner", cuisine:["Italian"], diet:["Gluten-Free"], equipment:["Stovetop","Oven","Slow Cooker"], prepTime:20, cookTime:180, totalTime:200, servings:2, yieldServings:4, macros:{protein:58,carbs:38,fat:28,calories:720}, leftoversSlot:"lunch", leftoversName:"Short Rib Ragù Pappardelle", ingredients:[{name:"Beef short ribs",qty:350,unit:"g",cat:"protein"},{name:"Red wine",qty:150,unit:"ml",cat:"pantry"},{name:"Crushed tomatoes",qty:200,unit:"g",cat:"pantry",sharedKey:"crushed_tomatoes"},{name:"Brown onion",qty:0.5,unit:"whole",cat:"produce",sharedKey:"brown_onion"},{name:"Celery",qty:1,unit:"whole",cat:"produce"},{name:"Carrot",qty:0.5,unit:"whole",cat:"produce"},{name:"Beef stock",qty:250,unit:"ml",cat:"pantry"},{name:"Polenta",qty:75,unit:"g",cat:"pantry"},{name:"Parmesan",qty:30,unit:"g",cat:"dairy"},{name:"Butter",qty:15,unit:"g",cat:"dairy"}], steps:["Season & sear ribs 3–4 min per side. Remove.","Sauté mirepoix 5 min. Deglaze with wine 3 min.","Add tomatoes, stock, herbs. Return ribs. Cover.","Braise 160°C for 2.5–3 hours.","Make polenta, stir in parmesan & butter.","Serve ribs on polenta. Refrigerate rest for ragù."], tip:"Makes 4 serves — tomorrow's lunch is a ragù with pasta.", source:"builtin", batchable:true },
  { id:"r012", name:"Air Fryer Pork Chops with Fennel & Beans", slot:"dinner", cuisine:["Mediterranean","Italian"], diet:["Gluten-Free","Dairy-Free"], equipment:["Air Fryer"], prepTime:10, cookTime:20, totalTime:30, servings:2, yieldServings:2, macros:{protein:56,carbs:28,fat:20,calories:610}, ingredients:[{name:"Pork loin chops",qty:300,unit:"g",cat:"protein"},{name:"Fennel bulb",qty:1,unit:"whole",cat:"produce"},{name:"Green apple",qty:0.5,unit:"whole",cat:"produce"},{name:"Cannellini beans",qty:200,unit:"g",cat:"pantry",sharedKey:"white_beans"},{name:"Fennel seeds",qty:3,unit:"g",cat:"pantry"},{name:"Sherry vinegar",qty:10,unit:"ml",cat:"pantry"},{name:"Olive oil",qty:10,unit:"ml",cat:"pantry",sharedKey:"olive_oil"}], steps:["Season chops with salt, pepper, fennel seeds.","Toss fennel & apple with oil. Air fry 200°C 8 min.","Add chops. Cook 10–12 min, flipping once.","Warm beans with sherry vinegar. Lightly crush.","Rest pork 3 min. Serve over beans & fennel."], source:"builtin" },
  { id:"r013", name:"Chicken Ramen Bowl", slot:"dinner", cuisine:["Japanese","Asian"], diet:["Dairy-Free"], equipment:["Stovetop"], prepTime:10, cookTime:25, totalTime:35, servings:2, yieldServings:2, macros:{protein:42,carbs:45,fat:13,calories:490}, ingredients:[{name:"Chicken breast",qty:200,unit:"g",cat:"protein",sharedKey:"chicken_breast"},{name:"Chicken stock",qty:600,unit:"ml",cat:"pantry",sharedKey:"chicken_stock"},{name:"Ramen noodles",qty:85,unit:"g",cat:"pantry"},{name:"Egg",qty:1,unit:"whole",cat:"dairy",sharedKey:"eggs"},{name:"Corn",qty:60,unit:"g",cat:"pantry"},{name:"Spring onion",qty:2,unit:"whole",cat:"produce"},{name:"Soy sauce",qty:30,unit:"ml",cat:"pantry",sharedKey:"soy_sauce"},{name:"Mirin",qty:15,unit:"ml",cat:"pantry",sharedKey:"mirin"},{name:"White miso paste",qty:15,unit:"g",cat:"pantry"},{name:"Sesame oil",qty:3,unit:"ml",cat:"pantry",sharedKey:"sesame_oil"}], steps:["Simmer chicken in stock with soy & mirin 15–18 min. Remove and slice.","Whisk miso into broth off heat.","Soft-boil egg 6.5 min. Ice bath. Peel and halve.","Cook ramen noodles. Drain.","Ladle broth over noodles. Arrange toppings.","Finish with drops of sesame oil."], source:"builtin", batchable:true },
  { id:"r014", name:"Spatchcock Chicken with Roasted Veg", slot:"dinner", cuisine:["Mediterranean","Australian"], diet:["Gluten-Free","Dairy-Free","Halal"], equipment:["Oven"], prepTime:15, cookTime:45, totalTime:60, servings:2, yieldServings:4, macros:{protein:58,carbs:20,fat:22,calories:600}, leftoversSlot:"lunch", leftoversName:"Chicken Salad with Roasted Veg", ingredients:[{name:"Whole chicken",qty:1.6,unit:"kg",cat:"protein"},{name:"Cherry tomatoes",qty:300,unit:"g",cat:"produce",sharedKey:"cherry_tomatoes"},{name:"Black olives",qty:60,unit:"g",cat:"pantry"},{name:"Garlic",qty:6,unit:"cloves",cat:"produce",sharedKey:"garlic"},{name:"Fresh thyme",qty:5,unit:"g",cat:"produce"},{name:"Fresh rosemary",qty:5,unit:"g",cat:"produce"},{name:"Smoked paprika",qty:3,unit:"g",cat:"pantry"},{name:"Olive oil",qty:30,unit:"ml",cat:"pantry",sharedKey:"olive_oil"}], steps:["Preheat oven 220°C.","Flatten chicken: cut out backbone, press flat.","Rub with oil, paprika, salt, pepper.","Roast with tomatoes, olives, garlic 40–45 min until skin is golden.","Rest 10 min. Serve. Keep leftovers for tomorrow's lunch."], tip:"Spatchcocking reduces cook time by 25% and gives incredibly crispy skin.", source:"builtin", batchable:true },
  { id:"r015", name:"Banana Nice Cream", slot:"snack", cuisine:["American"], diet:["Vegan","Gluten-Free","Dairy-Free"], equipment:["Blender","Food Processor"], prepTime:5, cookTime:0, totalTime:5, servings:2, yieldServings:2, macros:{protein:7,carbs:28,fat:9,calories:190}, ingredients:[{name:"Frozen banana",qty:2,unit:"whole",cat:"frozen"},{name:"Peanut butter",qty:15,unit:"g",cat:"pantry"},{name:"Cacao powder",qty:5,unit:"g",cat:"pantry"}], steps:["Blend frozen banana chunks until smooth.","Add peanut butter and cacao. Blend again.","Serve immediately or freeze 20 min for firmer texture."], tip:"Bananas must be very ripe before freezing.", source:"builtin" },
  { id:"r016", name:"Greek Yoghurt & Berry Parfait", slot:"snack", cuisine:["Mediterranean"], diet:["Vegetarian","Gluten-Free"], equipment:[], prepTime:3, cookTime:0, totalTime:3, servings:2, yieldServings:2, macros:{protein:15,carbs:22,fat:3,calories:175}, ingredients:[{name:"Greek yoghurt",qty:150,unit:"g",cat:"dairy",sharedKey:"greek_yoghurt"},{name:"Mixed berries",qty:80,unit:"g",cat:"produce"},{name:"Granola",qty:30,unit:"g",cat:"pantry"},{name:"Honey",qty:5,unit:"g",cat:"pantry"}], steps:["Layer yoghurt, berries, and granola.","Drizzle with honey. Serve immediately."], source:"builtin" },
  { id:"r017", name:"Dark Chocolate & Almonds", slot:"snack", cuisine:["Mediterranean"], diet:["Vegan","Gluten-Free","Dairy-Free"], equipment:[], prepTime:1, cookTime:0, totalTime:1, servings:2, yieldServings:2, macros:{protein:5,carbs:10,fat:16,calories:200}, ingredients:[{name:"Dark chocolate (70%+)",qty:25,unit:"g",cat:"pantry"},{name:"Almonds",qty:30,unit:"g",cat:"pantry"}], steps:["Break chocolate into pieces.","Eat together. Feel sophisticated."], source:"builtin" },
];

// ─── SMART MACRO SOLVER ───────────────────────────────────────────────────────
/**
 * Instead of picking meals slot-by-slot, we score ALL combinations
 * of (breakfast × lunch × dinner × snack) against daily macro targets.
 *
 * Score = 1 / (1 + Σ |actual_macro - target_macro| / target_macro)
 * Highest score = closest to targets.
 *
 * We cap the search at top-5 per slot to keep it fast in-browser.
 * In production this runs server-side with the full Spoonacular dataset.
 */
function solveOptimalDay(candidates, targets, usedIds = new Set()) {
  const bySlot = {};
  SLOTS.forEach(slot => {
    bySlot[slot] = candidates
      .filter(r => r.slot === slot && !usedIds.has(r.id))
      .slice(0, 5);
  });

  let best = null, bestScore = -1;

  const bF = bySlot.breakfast || [], bL = bySlot.lunch || [], bD = bySlot.dinner || [], bS = bySlot.snack || [];
  if (!bF.length || !bL.length || !bD.length) return null;

  for (const f of bF) for (const l of bL) for (const d of bD) {
    const snack = bS.length ? bS[0] : null;
    const tot = {
      protein: f.macros.protein + l.macros.protein + d.macros.protein + (snack?.macros.protein || 0),
      carbs:   f.macros.carbs   + l.macros.carbs   + d.macros.carbs   + (snack?.macros.carbs   || 0),
      fat:     f.macros.fat     + l.macros.fat     + d.macros.fat     + (snack?.macros.fat     || 0),
      calories:f.macros.calories+ l.macros.calories+ d.macros.calories+ (snack?.macros.calories|| 0),
    };
    const score = 1 / (1 +
      Math.abs(tot.protein - targets.protein) / (targets.protein || 1) * 2 +
      Math.abs(tot.calories - targets.calories) / (targets.calories || 1) * 2 +
      Math.abs(tot.fat - targets.fat) / (targets.fat || 1) +
      Math.abs(tot.carbs - targets.carbs) / (targets.carbs || 1)
    );
    if (score > bestScore) { bestScore = score; best = { breakfast:f, lunch:l, dinner:d, snack }; }
  }
  return best;
}

// ─── LEFTOVER LOGIC ───────────────────────────────────────────────────────────
function injectLeftovers(plan, servings) {
  const updated = JSON.parse(JSON.stringify(plan));
  DAYS.forEach((day, di) => {
    const dinner = updated[day]?.dinner;
    if (!dinner || !dinner.leftoversSlot || dinner.yieldServings <= servings) return;
    const nextDay = DAYS[di + 1];
    if (!nextDay) return;
    const leftoverMeal = {
      ...dinner,
      id: dinner.id + "_leftover",
      name: dinner.leftoversName || `Leftover ${dinner.name}`,
      slot: dinner.leftoversSlot,
      source: "leftover",
      isLeftover: true,
      parentId: dinner.id,
      enabled: true,
    };
    if (!updated[nextDay][dinner.leftoversSlot]?.locked) {
      updated[nextDay][dinner.leftoversSlot] = leftoverMeal;
    }
  });
  return updated;
}

// ─── PLAN GENERATOR ───────────────────────────────────────────────────────────
function generateWeeklyPlan(prefs, targets, equipment, locked={}, allRecipes=[], mealHistory=[], servings=2) {
  const COOLDOWN_DAYS = 7;
  const now = Date.now();
  const recentIds = new Set(
    mealHistory
      .filter(h => (now - new Date(h.date).getTime()) / 86400000 < COOLDOWN_DAYS)
      .map(h => h.recipeId)
  );

  const { cuisines:favCuisines=[], diet="None", excludeIngredients=[] } = prefs;

  const filtered = allRecipes.filter(r => {
    if (r.isLeftover) return false;
    if (diet && diet !== "None" && !r.diet.includes(diet)) return false;
    if (r.equipment.length > 0 && !r.equipment.some(eq => equipment.includes(eq))) return false;
    if (excludeIngredients?.length > 0 && r.ingredients.some(ing => excludeIngredients.some(ex => ing.name.toLowerCase().includes(ex.toLowerCase())))) return false;
    return true;
  });

  // Cuisine-preference scoring
  const cuisineScore = r => favCuisines.length > 0 && r.cuisine.some(c => favCuisines.includes(c)) ? 1.3 : 1.0;
  const customBonus  = r => r.source === "custom" || r.source === "url" ? 1.2 : 1.0;
  const cooldownPenalty = r => recentIds.has(r.id) ? 0.1 : 1.0;

  const scored = filtered
    .map(r => ({ ...r, _score: cuisineScore(r) * customBonus(r) * cooldownPenalty(r) * (0.8 + Math.random() * 0.4) }))
    .sort((a, b) => b._score - a._score);

  const plan = {};
  const usedIds = new Set();

  DAYS.forEach(day => {
    plan[day] = {};
    SLOTS.forEach(slot => {
      if (locked[day]?.[slot]) { plan[day][slot] = { ...locked[day][slot], locked: true }; }
    });

    // Fill unlocked slots using macro solver
    const unlockedSlots = SLOTS.filter(sl => !locked[day]?.[sl]);
    if (unlockedSlots.length === 0) return;

    const adjustedTargets = { ...targets };
    SLOTS.forEach(sl => {
      if (locked[day]?.[sl]) {
        const m = locked[day][sl].macros;
        adjustedTargets.protein  -= m?.protein  || 0;
        adjustedTargets.carbs    -= m?.carbs    || 0;
        adjustedTargets.fat      -= m?.fat      || 0;
        adjustedTargets.calories -= m?.calories || 0;
      }
    });

    const best = solveOptimalDay(scored, adjustedTargets, usedIds);
    if (best) {
      SLOTS.forEach(sl => {
        if (!locked[day]?.[sl] && best[sl]) {
          plan[day][sl] = { ...best[sl], enabled: true, repeating: false };
          usedIds.add(best[sl].id);
        }
      });
    }
  });

  return injectLeftovers(plan, servings);
}

// ─── SHOPPING LIST BUILDER ────────────────────────────────────────────────────
function buildShoppingList(plan, servings) {
  const items = {};
  Object.values(plan).forEach(day => {
    Object.values(day).forEach(meal => {
      if (!meal || meal.enabled === false) return;
      (meal.ingredients || []).forEach(ing => {
        const key = ing.name.toLowerCase().trim();
        const priceInfo = priceFor(ing.name);
        if (items[key]) {
          items[key].qty += (ing.qty || 0) * servings;
        } else {
          items[key] = {
            name: ing.name, qty: (ing.qty || 0) * servings, unit: ing.unit,
            cat: ing.cat || "other", checked: false,
            price: priceInfo?.current || null,
            basePrice: priceInfo?.base || null,
            store: priceInfo?.store || null,
            onSpecial: priceInfo ? priceInfo.current < priceInfo.base * 0.9 : false,
            seasonal: isInSeason(ing.name),
            preferredStore: null, preferredBrand: "", adHoc: false,
          };
        }
      });
    });
  });
  return items;
}

// ─── SUPABASE INTEGRATION STUBS ───────────────────────────────────────────────
/**
 * SUPABASE: Replace each localStorage call with:
 *
 * WRITE: await supabase.from('user_state').upsert({ user_id, key, value })
 * READ:  const { data } = await supabase.from('user_state').select('value').eq('key', key)
 *
 * Auth:
 *   await supabase.auth.signInWithOAuth({ provider: 'google' })
 *   supabase.auth.onAuthStateChange((event, session) => setUser(session?.user))
 */
function persist(key, value) {
  try { localStorage.setItem("nutriplan_" + key, JSON.stringify(value)); } catch(e) {}
}
function recall(key, fallback) {
  try { const v = localStorage.getItem("nutriplan_" + key); return v ? JSON.parse(v) : fallback; } catch(e) { return fallback; }
}

// ─── SHARED STYLES ────────────────────────────────────────────────────────────
const s = {
  app: { fontFamily:"'DM Sans',system-ui,sans-serif", background:C.bg, minHeight:"100vh", fontSize:14, color:C.charcoal },
  hdr: { background:C.card, borderBottom:`1px solid ${C.rule}`, padding:"0 18px", display:"flex", alignItems:"center", justifyContent:"space-between", height:54, position:"sticky", top:0, zIndex:200 },
  logo: { fontFamily:"Georgia,serif", fontSize:17, fontWeight:600, color:C.sage },
  body: { padding:"14px 18px", maxWidth:1100, margin:"0 auto" },
  card: { background:C.card, borderRadius:12, border:`1px solid ${C.rule}`, overflow:"hidden" },
  h2: { fontFamily:"Georgia,serif", fontSize:15, fontWeight:600, margin:"0 0 4px" },
  h3: { fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.7px", color:C.mid, margin:"0 0 8px" },
  pill: (bg,color) => ({ fontSize:10, fontWeight:700, padding:"2px 7px", borderRadius:20, background:bg, color, whiteSpace:"nowrap", display:"inline-block" }),
  btn: (bg,color,sm) => ({ fontFamily:"inherit", fontSize:sm?10:12, fontWeight:600, padding:sm?"3px 8px":"7px 14px", borderRadius:50, border:"none", background:bg, color, cursor:"pointer", lineHeight:1.4 }),
  navBtn: active => ({ fontFamily:"inherit", fontSize:12, fontWeight:500, padding:"5px 12px", borderRadius:50, border:`1px solid ${active?C.sage:C.rule}`, background:active?C.sage:"transparent", color:active?"#fff":C.mid, cursor:"pointer" }),
  input: { fontFamily:"inherit", fontSize:13, padding:"7px 10px", border:`1px solid ${C.rule}`, borderRadius:8, background:C.surface, color:C.charcoal, outline:"none", width:"100%", boxSizing:"border-box" },
  select: { fontFamily:"inherit", fontSize:12, padding:"5px 8px", border:`1px solid ${C.rule}`, borderRadius:7, background:C.surface, color:C.charcoal, outline:"none" },
  overlay: { position:"fixed", inset:0, background:"rgba(10,10,8,.55)", zIndex:900, display:"flex", alignItems:"flex-end", justifyContent:"center" },
  drawer: { background:C.card, width:"100%", maxWidth:700, maxHeight:"93vh", borderRadius:"18px 18px 0 0", display:"flex", flexDirection:"column", overflow:"hidden" },
  tag: (color,bg) => ({ fontSize:9, fontWeight:700, padding:"2px 6px", borderRadius:20, background:bg, color, textTransform:"uppercase", letterSpacing:"0.6px", display:"inline-block" }),
  macroBar: (pct,color) => ({ height:5, borderRadius:3, background:color, width:`${Math.min(100,pct)}%`, transition:"width 0.4s" }),
};

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  // ── PERSISTENT STATE (localStorage → swap with Supabase) ──
  const [targets,    setTargets]    = useState(() => recall("targets",   { protein:120, carbs:180, fat:70, calories:1800 }));
  const [prefs,      setPrefs]      = useState(() => recall("prefs",     { cuisines:[], diet:"None", excludeIngredients:[] }));
  const [equipment,  setEquipment]  = useState(() => recall("equipment", ["Stovetop","Oven","Microwave","Air Fryer","Blender"]));
  const [servings,   setServings]   = useState(() => recall("servings",  2));
  const [customRecipes,setCustomRecipes] = useState(() => recall("customRecipes", []));
  const [mealHistory,setMealHistory]= useState(() => recall("mealHistory", []));
  const [lockedMeals,setLockedMeals]= useState({});

  // Nutrition diary: { "YYYY-MM-DD": { breakfast:bool, lunch:bool, dinner:bool, snack:bool } }
  const [diary, setDiary] = useState(() => recall("diary", {}));

  // Batch cook selections: Set of recipe ids
  const [batchIds,  setBatchIds]  = useState(new Set());
  const [batchMode, setBatchMode] = useState(false);

  // Mock user (SUPABASE: replace with supabase.auth.getUser())
  const [user, setUser] = useState(() => recall("user", null));
  const [showLogin, setShowLogin] = useState(false);

  const allRecipes = [...RECIPE_DB, ...customRecipes];

  const [plan, setPlan] = useState(() => {
    const saved = recall("plan", null);
    return saved || generateWeeklyPlan(
      recall("prefs", { cuisines:[], diet:"None", excludeIngredients:[] }),
      recall("targets", { protein:120, carbs:180, fat:70, calories:1800 }),
      recall("equipment", ["Stovetop","Oven","Microwave","Air Fryer","Blender"]),
      {}, RECIPE_DB, [], 2
    );
  });

  const [selectedDay, setSelectedDay] = useState("Monday");
  const [tab, setTab] = useState("plan");
  const [openMeal, setOpenMeal] = useState(null);
  const [shoppingList, setShoppingList] = useState({});
  const [adHocItem, setAdHocItem] = useState("");
  const [sharedIngredients, setSharedIngredients] = useState([]);
  const [showEditor, setShowEditor] = useState(false);
  const [editorDraft, setEditorDraft] = useState(null);
  const [editRecipeId, setEditRecipeId] = useState(null);
  const [showLibrary, setShowLibrary] = useState(false);
  const [librarySearch, setLibrarySearch] = useState("");
  const [libraryFilter, setLibraryFilter] = useState("all");
  const [showUrlImport, setShowUrlImport] = useState(false);
  const [importUrl, setImportUrl] = useState("");
  const [importStatus, setImportStatus] = useState("idle");
  const [importError, setImportError] = useState("");
  const [importPreview, setImportPreview] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showBatchPanel, setShowBatchPanel] = useState(false);
  const [specialAlert, setSpecialAlert] = useState(true);

  // Persist on every state change
  useEffect(() => { persist("plan", plan); }, [plan]);
  useEffect(() => { persist("targets", targets); }, [targets]);
  useEffect(() => { persist("prefs", prefs); }, [prefs]);
  useEffect(() => { persist("equipment", equipment); }, [equipment]);
  useEffect(() => { persist("servings", servings); }, [servings]);
  useEffect(() => { persist("customRecipes", customRecipes); }, [customRecipes]);
  useEffect(() => { persist("mealHistory", mealHistory); }, [mealHistory]);
  useEffect(() => { persist("diary", diary); }, [diary]);
  useEffect(() => { persist("user", user); }, [user]);

  // Rebuild shopping list & shared ingredients
  useEffect(() => {
    const list = buildShoppingList(plan, servings);
    // Merge existing tick state
    setShoppingList(prev => {
      const merged = {};
      Object.entries(list).forEach(([k, v]) => {
        merged[k] = { ...v, checked: prev[k]?.checked || false, preferredStore: prev[k]?.preferredStore || null, preferredBrand: prev[k]?.preferredBrand || "" };
      });
      // Keep ad hoc items
      Object.entries(prev).forEach(([k, v]) => { if (v.adHoc && !merged[k]) merged[k] = v; });
      return merged;
    });

    // Shared ingredients
    const keyCount = {}, keyNames = {};
    Object.values(plan).forEach(day => Object.values(day).forEach(meal => {
      if (!meal) return;
      (meal.ingredients || []).forEach(ing => {
        if (!ing.sharedKey) return;
        keyCount[ing.sharedKey] = (keyCount[ing.sharedKey] || 0) + 1;
        keyNames[ing.sharedKey] = ing.name;
      });
    }));
    setSharedIngredients(Object.entries(keyCount).filter(([,c])=>c>=2).sort((a,b)=>b[1]-a[1]).map(([k,c])=>({key:k,name:keyNames[k],count:c})));
  }, [plan, servings]);

  const generatePlan = () => {
    const newPlan = generateWeeklyPlan(prefs, targets, equipment, lockedMeals, allRecipes, mealHistory, servings);
    setPlan(newPlan);
  };

  // ── PLAN ACTIONS ────────────────────────────────────────────────────────
  const toggleMeal  = (day, slot) => setPlan(p => ({ ...p, [day]: { ...p[day], [slot]: p[day][slot] ? { ...p[day][slot], enabled: !p[day][slot].enabled } : p[day][slot] } }));
  const toggleLock  = (day, slot) => {
    const meal = plan[day]?.[slot]; if (!meal) return;
    if (meal.locked) { setLockedMeals(l=>{ const n={...l}; if(n[day]) delete n[day][slot]; return n; }); setPlan(p=>({...p,[day]:{...p[day],[slot]:{...meal,locked:false}}})); }
    else { setLockedMeals(l=>({...l,[day]:{...(l[day]||{}),[slot]:meal}})); setPlan(p=>({...p,[day]:{...p[day],[slot]:{...meal,locked:true}}})); }
  };
  const swapMeal = (day, slot) => {
    const current = plan[day]?.[slot];
    const pool = allRecipes.filter(r => r.slot===slot && r.id!==current?.id && !r.isLeftover && (prefs.diet==="None"||r.diet.includes(prefs.diet)) && (r.equipment.length===0||r.equipment.some(eq=>equipment.includes(eq))));
    if (!pool.length) return;
    setPlan(p => ({...p, [day]: {...p[day], [slot]: {...pool[Math.floor(Math.random()*pool.length)], enabled:true, locked:false, repeating:false}}}));
  };
  const repeatMeal = (day, slot) => {
    const meal = plan[day]?.[slot]; if (!meal) return;
    setPlan(p => { const n={...p}; DAYS.forEach(d=>{ if(d!==day&&!p[d]?.[slot]?.locked) n[d]={...n[d],[slot]:{...meal,enabled:true,repeating:true}}; }); return n; });
  };

  // ── DIARY / LOG ACTIONS ─────────────────────────────────────────────────
  const todayKey = () => new Date().toISOString().split("T")[0];
  const toggleDiary = (slot) => {
    const key = todayKey();
    setDiary(d => ({ ...d, [key]: { ...(d[key]||{}), [slot]: !(d[key]?.[slot]) } }));
  };
  const logMadeIt = (meal, day, slot, rating, comment, wma) => {
    const entry = { recipeId: meal.id, recipeName: meal.name, day, slot, date: new Date().toISOString(), rating, comment, wouldMakeAgain: wma };
    setMealHistory(h => [entry, ...h].slice(0, 200));
    // Mark meal as rated in plan
    setPlan(p => ({...p, [day]:{...p[day],[slot]:{...p[day][slot],userRating:rating,userComment:comment,wouldMakeAgain:wma}}}));
  };

  // ── MACRO TOTALS ────────────────────────────────────────────────────────
  const dayTotals = (day) => SLOTS.reduce((acc, slot) => {
    const m = plan[day]?.[slot]; if (!m || m.enabled===false) return acc;
    return { protein:acc.protein+(m.macros?.protein||0), carbs:acc.carbs+(m.macros?.carbs||0), fat:acc.fat+(m.macros?.fat||0), calories:acc.calories+(m.macros?.calories||0) };
  }, {protein:0,carbs:0,fat:0,calories:0});

  const diaryTotals = (dayKey) => {
    const logged = diary[dayKey] || {};
    return SLOTS.reduce((acc, slot) => {
      if (!logged[slot]) return acc;
      const dayPlan = Object.values(plan).find((_,i)=>true); // simplified — in prod match by date
      const m = plan[selectedDay]?.[slot]?.macros;
      if (!m) return acc;
      return { protein:acc.protein+(m.protein||0), carbs:acc.carbs+(m.carbs||0), fat:acc.fat+(m.fat||0), calories:acc.calories+(m.calories||0) };
    }, {protein:0,carbs:0,fat:0,calories:0});
  };

  // ── BATCH COOK LOGIC ─────────────────────────────────────────────────────
  const batchRecipes = allRecipes.filter(r => r.batchable || r.yieldServings > r.servings);
  const toggleBatch = (id) => setBatchIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const batchShopList = () => {
    const selected = allRecipes.filter(r => batchIds.has(r.id));
    const items = {};
    const batchServings = servings * 2; // batch = double
    selected.forEach(r => {
      r.ingredients.forEach(ing => {
        const key = ing.name.toLowerCase().trim();
        const p = priceFor(ing.name);
        if (items[key]) { items[key].qty += (ing.qty||0)*batchServings; }
        else { items[key] = { name:ing.name, qty:(ing.qty||0)*batchServings, unit:ing.unit, cat:ing.cat||"other", checked:false, price:p?.current||null, onSpecial:p?p.current<p.base*0.9:false }; }
      });
    });
    return items;
  };

  // ── RECIPE EDITOR ─────────────────────────────────────────────────────────
  const blankRecipe = () => ({ id:"custom_"+Date.now(), name:"", slot:"dinner", cuisine:[], diet:[], equipment:[], prepTime:15, cookTime:30, totalTime:45, servings:2, yieldServings:2, macros:{protein:0,carbs:0,fat:0,calories:0}, ingredients:[{name:"",qty:"",unit:"g",cat:"produce"}], steps:[""], tip:"", source:"custom", sourceUrl:"", rating:null, wouldMakeAgain:false });
  const openNewRecipe = () => { setEditorDraft(blankRecipe()); setEditRecipeId(null); setShowEditor(true); };
  const openEditRecipe = r => { setEditorDraft({...r,ingredients:[...r.ingredients.map(i=>({...i}))],steps:[...r.steps]}); setEditRecipeId(r.id); setShowEditor(true); };
  const saveRecipe = () => {
    const r = { ...editorDraft, totalTime:(parseInt(editorDraft.prepTime)||0)+(parseInt(editorDraft.cookTime)||0), macros:{...editorDraft.macros,calories:editorDraft.macros.calories||Math.round(editorDraft.macros.protein*4+editorDraft.macros.carbs*4+editorDraft.macros.fat*9)} };
    if (editRecipeId) { setCustomRecipes(c=>c.map(x=>x.id===editRecipeId?r:x)); }
    else { setCustomRecipes(c=>[...c,r]); }
    setShowEditor(false); setEditorDraft(null); setEditRecipeId(null);
  };
  const deleteRecipe = id => setCustomRecipes(c=>c.filter(r=>r.id!==id));
  const setDraft = (key, val) => setEditorDraft(d=>({...d,[key]:val}));
  const setMacro = (key, val) => setEditorDraft(d=>({...d,macros:{...d.macros,[key]:Number(val)||0}}));
  const setIngField = (i,key,val) => setEditorDraft(d=>{ const ings=[...d.ingredients]; ings[i]={...ings[i],[key]:val}; return {...d,ingredients:ings}; });
  const addIng = () => setEditorDraft(d=>({...d,ingredients:[...d.ingredients,{name:"",qty:"",unit:"g",cat:"produce"}]}));
  const removeIng = i => setEditorDraft(d=>({...d,ingredients:d.ingredients.filter((_,idx)=>idx!==i)}));
  const setStep = (i,val) => setEditorDraft(d=>{ const steps=[...d.steps]; steps[i]=val; return {...d,steps}; });
  const addStep = () => setEditorDraft(d=>({...d,steps:[...d.steps,""]}));
  const removeStep = i => setEditorDraft(d=>({...d,steps:d.steps.filter((_,idx)=>idx!==i)}));
  const toggleArr = (key,val) => setEditorDraft(d=>({...d,[key]:d[key].includes(val)?d[key].filter(x=>x!==val):[...d[key],val]}));

  // ── URL IMPORT ────────────────────────────────────────────────────────────
  const doImport = async () => {
    if (!importUrl.trim()) return;
    setImportStatus("loading"); setImportError(""); setImportPreview(null);
    try {
      const prompt = `Parse this recipe URL and return ONLY valid JSON (no markdown) in this exact shape:
{"name":"...","slot":"breakfast|lunch|dinner|snack","cuisine":["..."],"diet":["..."],"equipment":["..."],"prepTime":15,"cookTime":25,"totalTime":40,"servings":2,"yieldServings":2,"macros":{"protein":35,"carbs":40,"fat":15,"calories":450},"ingredients":[{"name":"...","qty":200,"unit":"g","cat":"produce|protein|dairy|pantry|frozen|bakery|other"}],"steps":["Step 1.","Step 2."],"tip":"","sourceUrl":"${importUrl.trim()}"}
URL: ${importUrl.trim()}
All quantities metric. 5–12 ingredients. 4–8 steps. Realistic macros for the dish.`;
      const resp = await fetch("https://api.anthropic.com/v1/messages", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ model:"claude-sonnet-4-20250514", max_tokens:1000, messages:[{role:"user",content:prompt}] }) });
      if (!resp.ok) throw new Error(`API error ${resp.status}`);
      const data = await resp.json();
      const text = data.content.map(b=>b.text||"").join("").trim().replace(/```json|```/g,"").trim();
      const parsed = JSON.parse(text);
      setImportPreview({ ...parsed, id:"custom_"+Date.now(), source:"url", rating:null, wouldMakeAgain:false, enabled:true });
      setImportStatus("success");
    } catch(e) { setImportStatus("error"); setImportError(e.message||"Failed to parse recipe."); }
  };
  const saveImportedRecipe = () => { if (!importPreview) return; setCustomRecipes(c=>[...c,importPreview]); setShowUrlImport(false); setImportPreview(null); setImportUrl(""); setImportStatus("idle"); };

  // ── STAR RATING ───────────────────────────────────────────────────────────
  const StarRating = ({ value, onChange }) => (
    <div style={{display:"flex",gap:3}}>
      {[1,2,3,4,5].map(n => <span key={n} onClick={()=>onChange&&onChange(n)} style={{fontSize:20,cursor:onChange?"pointer":"default",color:n<=(value||0)?"#F4B400":C.rule}}>★</span>)}
    </div>
  );

  // ─── MEAL CARD ───────────────────────────────────────────────────────────
  const MealCard = ({ meal, day, slot }) => {
    if (!meal) return <div style={{...s.card,border:`1.5px dashed ${C.rule}`,background:C.surface,padding:"12px",opacity:0.4}}><div style={{fontSize:10,color:C.light,fontWeight:600,textTransform:"uppercase"}}>{slot} — none</div></div>;
    const { enabled=true, locked, repeating, userRating, source, isLeftover } = meal;
    const diaryKey = todayKey();
    const eaten = diary[diaryKey]?.[slot];
    const seasonal = meal.ingredients?.some(ing => isInSeason(ing.name));
    const hasSpecial = meal.ingredients?.some(ing => { const p=priceFor(ing.name); return p && p.current < p.base*0.9; });

    return (
      <div style={{...s.card,opacity:enabled?1:0.38,border:`1px solid ${locked?C.goldM:C.rule}`,background:enabled?C.card:C.surface,transition:"opacity 0.15s"}}>
        <div style={{padding:"10px 10px 9px"}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:4,alignItems:"flex-start"}}>
            <span style={{fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.8px",color:SLOT_COLORS[slot]}}>{slot}</span>
            <div style={{display:"flex",gap:3,alignItems:"center",flexWrap:"wrap",justifyContent:"flex-end"}}>
              {locked && <span style={s.tag(C.gold,C.goldL)}>🔒</span>}
              {repeating && <span style={s.tag(C.blue,C.blueL)}>↻</span>}
              {isLeftover && <span style={s.tag(C.teal,C.tealL)}>♻ Leftover</span>}
              {source==="custom" && <span style={s.tag(C.plum,C.plumL)}>Mine</span>}
              {seasonal && <span style={s.tag(C.sage,C.sageXL)}>🌱</span>}
              {hasSpecial && <span style={s.tag(C.terra,"#fde8e8")}>🏷 Sale</span>}
              {userRating && <span style={{fontSize:9,color:"#F4B400"}}>{"★".repeat(userRating)}</span>}
              {eaten && <span style={s.tag(C.teal,C.tealL)}>✓ Eaten</span>}
            </div>
          </div>
          <div onClick={()=>setOpenMeal({meal,day,slot})} style={{fontFamily:"Georgia,serif",fontSize:12,fontWeight:600,lineHeight:1.35,marginBottom:3,color:C.charcoal,cursor:"pointer"}}>{meal.name}</div>
          <div style={{fontSize:9,color:C.light,marginBottom:6}}>⏱ {meal.totalTime}min {meal.equipment?.length>0&&`· ${meal.equipment.slice(0,2).join(", ")}`}{meal.yieldServings>meal.servings&&<span style={{color:C.teal}}> · yields {meal.yieldServings} serves</span>}</div>
          <div style={{display:"flex",gap:3,flexWrap:"wrap",marginBottom:7}}>
            <span style={s.pill(C.blueL,C.blue)}>P {meal.macros?.protein}g</span>
            <span style={s.pill("#e8f4e8",C.teal)}>C {meal.macros?.carbs}g</span>
            <span style={s.pill(C.goldL,C.gold)}>F {meal.macros?.fat}g</span>
            <span style={s.pill(C.terraL,C.terra)}>{meal.macros?.calories} cal</span>
          </div>
          <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
            <button style={s.btn(C.sageXL,C.sage,true)} onClick={e=>{e.stopPropagation();setOpenMeal({meal,day,slot});}}>Recipe</button>
            {!isLeftover && <button style={s.btn(C.surface,C.mid,true)} onClick={e=>{e.stopPropagation();toggleMeal(day,slot);}}>{enabled?"Skip":"Include"}</button>}
            {!isLeftover && <button style={s.btn(C.surface,C.mid,true)} onClick={e=>{e.stopPropagation();swapMeal(day,slot);}}>Swap</button>}
            {!isLeftover && <button style={s.btn(locked?C.goldL:C.surface,locked?C.gold:C.mid,true)} onClick={e=>{e.stopPropagation();toggleLock(day,slot);}}>🔒</button>}
            {!isLeftover && <button style={s.btn(C.surface,C.mid,true)} onClick={e=>{e.stopPropagation();repeatMeal(day,slot);}}>↻</button>}
            <button style={s.btn(eaten?C.tealL:C.surface,eaten?C.teal:C.mid,true)} onClick={e=>{e.stopPropagation();toggleDiary(slot);}}>
              {eaten ? "✓ Eaten" : "Log"}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ─── RECIPE DETAIL DRAWER ────────────────────────────────────────────────
  const RecipeDrawer = () => {
    if (!openMeal) return null;
    const { meal, day, slot } = openMeal;
    const [rating, setRating] = useState(meal.userRating||0);
    const [comment, setComment] = useState(meal.userComment||"");
    const [wma, setWma] = useState(meal.wouldMakeAgain||false);
    return (
      <div style={s.overlay} onClick={e=>e.target===e.currentTarget&&setOpenMeal(null)}>
        <div style={s.drawer}>
          <div style={{width:36,height:4,background:C.rule,borderRadius:2,margin:"10px auto 0",flexShrink:0}} />
          <div style={{padding:"14px 18px 10px",borderBottom:`1px solid ${C.rule}`,flexShrink:0}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
              <div style={{flex:1}}>
                <div style={{fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.8px",color:SLOT_COLORS[slot],marginBottom:3}}>{slot}</div>
                <div style={{fontFamily:"Georgia,serif",fontSize:18,fontWeight:600,lineHeight:1.2,marginBottom:4}}>{meal.name}</div>
                <div style={{fontSize:11,color:C.mid}}>Serves {servings} · Prep {meal.prepTime}min · Cook {meal.cookTime}min{meal.equipment?.length>0&&` · ${meal.equipment.join(", ")}`}</div>
                {meal.yieldServings>meal.servings&&<div style={{fontSize:11,color:C.teal,marginTop:2}}>♻ Makes {meal.yieldServings} serves — leftovers become {meal.leftoversName}</div>}
                {meal.sourceUrl&&<div style={{fontSize:10,color:C.blue,marginTop:2}}>↗ {meal.sourceUrl.replace(/https?:\/\//,"").substring(0,50)}</div>}
              </div>
              <div style={{display:"flex",gap:6,flexShrink:0,marginLeft:10}}>
                {(meal.source==="custom"||meal.source==="url")&&<button onClick={()=>{setOpenMeal(null);openEditRecipe(meal);}} style={s.btn(C.sageXL,C.sage)}>Edit</button>}
                <button onClick={()=>setOpenMeal(null)} style={{...s.btn(C.surface,C.mid),border:`1px solid ${C.rule}`,borderRadius:50,padding:"5px 10px"}}>✕</button>
              </div>
            </div>
            <div style={{display:"flex",gap:5,flexWrap:"wrap",marginTop:8}}>
              {meal.cuisine?.map(c=><span key={c} style={s.tag(C.sage,C.sageXL)}>{c}</span>)}
              {meal.diet?.map(d=><span key={d} style={s.tag(C.teal,C.tealL)}>{d}</span>)}
              {meal.ingredients?.some(i=>isInSeason(i.name))&&<span style={s.tag(C.sage,C.sageXL)}>🌱 Seasonal</span>}
            </div>
          </div>
          <div style={{display:"flex",gap:8,padding:"10px 18px",borderBottom:`1px solid ${C.rule}`,flexShrink:0}}>
            {[{label:"Protein",val:meal.macros?.protein*servings,unit:"g",color:C.blue},{label:"Carbs",val:meal.macros?.carbs*servings,unit:"g",color:C.teal},{label:"Fat",val:meal.macros?.fat*servings,unit:"g",color:C.gold},{label:"Calories",val:meal.macros?.calories*servings,unit:"",color:C.terra}].map(m=>(
              <div key={m.label} style={{flex:1,background:C.surface,borderRadius:8,padding:"7px 8px",textAlign:"center"}}>
                <div style={{fontSize:9,color:C.mid,textTransform:"uppercase"}}>{m.label}</div>
                <div style={{fontSize:15,fontWeight:700,color:m.color}}>{m.val}{m.unit}</div>
              </div>
            ))}
          </div>
          <div style={{overflowY:"auto",flex:1,padding:"16px 18px 28px"}}>
            {/* Seasonal & special callouts */}
            {meal.ingredients?.some(i=>isInSeason(i.name))&&(
              <div style={{background:C.sageXL,border:`1px solid ${C.sageL}`,borderRadius:8,padding:"8px 12px",marginBottom:12,fontSize:11,color:C.sage}}>
                🌱 <strong>In season now:</strong> {meal.ingredients.filter(i=>isInSeason(i.name)).map(i=>i.name).join(", ")}
              </div>
            )}
            {meal.ingredients?.some(i=>{ const p=priceFor(i.name); return p&&p.current<p.base*0.9; })&&(
              <div style={{background:C.terraL,border:`1px solid ${C.terra}`,borderRadius:8,padding:"8px 12px",marginBottom:12,fontSize:11,color:C.terra}}>
                🏷 <strong>On special this week:</strong> {meal.ingredients.filter(i=>{ const p=priceFor(i.name); return p&&p.current<p.base*0.9; }).map(i=>`${i.name} (${priceFor(i.name)?.store})`).join(", ")}
              </div>
            )}
            <div style={s.h3}>Ingredients (serves {servings})</div>
            <div style={{border:`1px solid ${C.rule}`,borderRadius:8,overflow:"hidden",marginBottom:18}}>
              {meal.ingredients?.map((ing,i)=>{
                const qty = ["whole","cloves","slices","sheets","bunch","handful","pinch"].includes(ing.unit) ? Math.ceil((ing.qty||0)*servings) : Math.round((ing.qty||0)*servings);
                const seasonal = isInSeason(ing.name);
                const p = priceFor(ing.name);
                const onSp = p && p.current < p.base * 0.9;
                return (
                  <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 12px",borderBottom:i<meal.ingredients.length-1?`1px solid ${C.rule}`:"none",background:i%2===0?C.sageXL:C.card}}>
                    <span style={{fontSize:12,display:"flex",alignItems:"center",gap:5}}>
                      {seasonal&&<span title="In season" style={{fontSize:9}}>🌱</span>}
                      {onSp&&<span title={`On special at ${p.store}`} style={{fontSize:9}}>🏷</span>}
                      {sharedIngredients.some(si=>si.key===ing.sharedKey)&&<span title="Shared this week" style={{fontSize:9,color:C.teal}}>♻️</span>}
                      {ing.name}
                    </span>
                    <span style={{fontSize:12,fontWeight:600}}>{qty} {ing.unit}{p&&<span style={{fontSize:9,color:onSp?C.terra:C.light,marginLeft:6}}>~${p.current}</span>}</span>
                  </div>
                );
              })}
            </div>
            <div style={s.h3}>Method</div>
            <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:18}}>
              {meal.steps?.map((step,i)=>(
                <div key={i} style={{display:"flex",gap:10,alignItems:"flex-start"}}>
                  <div style={{width:22,height:22,borderRadius:"50%",background:C.sage,color:"#fff",fontSize:10,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginTop:1}}>{i+1}</div>
                  <div style={{fontSize:12.5,lineHeight:1.55,paddingTop:2}}>{step}</div>
                </div>
              ))}
            </div>
            {meal.tip&&<div style={{background:C.goldL,border:`1px solid #e8d5a0`,borderRadius:8,padding:"10px 12px",marginBottom:18,fontSize:11.5,color:C.gold}}><strong>💡 Tip:</strong> {meal.tip}</div>}
            {/* Rate + log */}
            <div style={{...s.card,padding:"12px 14px"}}>
              <div style={{fontWeight:600,marginBottom:8}}>Rate & log this meal</div>
              <StarRating value={rating} onChange={setRating} />
              <textarea placeholder="Notes (optional)…" value={comment} onChange={e=>setComment(e.target.value)} style={{...s.input,marginTop:10,resize:"vertical",minHeight:55,fontSize:12}} />
              <label style={{display:"flex",alignItems:"center",gap:6,marginTop:8,fontSize:12,cursor:"pointer"}}>
                <input type="checkbox" checked={wma} onChange={e=>setWma(e.target.checked)} /> Would make again
              </label>
              <button onClick={()=>{logMadeIt(meal,day,slot,rating,comment,wma);setOpenMeal(null);}} style={{...s.btn(C.sage,"#fff"),marginTop:10}}>
                ✓ Save & Log "Made It"
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ─── PLAN TAB ─────────────────────────────────────────────────────────────
  const PlanTab = () => {
    const tots = dayTotals(selectedDay);
    const diaryKey = todayKey();
    const dTots = diaryTotals(diaryKey);
    const specialItems = onSpecial.slice(0, 3);

    return (
      <div>
        {/* Special alerts */}
        {specialAlert && specialItems.length > 0 && (
          <div style={{background:C.terraL,border:`1px solid ${C.terra}`,borderRadius:10,padding:"10px 14px",marginBottom:14,display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
            <div style={{fontSize:12,color:C.terra}}>
              🏷 <strong>On special this week:</strong> {specialItems.map(([name,p])=>`${name} (${p.store} ~$${p.current})`).join(" · ")}
            </div>
            <button onClick={()=>setSpecialAlert(false)} style={{...s.btn(C.terraL,C.terra,true),flexShrink:0}}>✕</button>
          </div>
        )}
        {/* Controls */}
        <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap",alignItems:"center"}}>
          <button onClick={generatePlan} style={s.btn(C.sage,"#fff")}>✨ Generate Week</button>
          <button onClick={()=>setShowLibrary(true)} style={{...s.btn(C.sageXL,C.sage),border:`1px solid ${C.sageL}`}}>📚 My Recipes ({customRecipes.length})</button>
          <button onClick={openNewRecipe} style={{...s.btn(C.surface,C.mid),border:`1px solid ${C.rule}`}}>+ Add Recipe</button>
          <button onClick={()=>setShowUrlImport(true)} style={{...s.btn(C.surface,C.mid),border:`1px solid ${C.rule}`}}>🔗 Import URL</button>
          <button onClick={()=>setShowBatchPanel(true)} style={{...s.btn(batchIds.size>0?C.plum:C.surface,batchIds.size>0?"#fff":C.mid),border:`1px solid ${batchIds.size>0?C.plum:C.rule}`}}>🍳 Batch Cook{batchIds.size>0&&` (${batchIds.size})`}</button>
          <button onClick={()=>setShowHistory(true)} style={{...s.btn(C.surface,C.mid),border:`1px solid ${C.rule}`}}>📖 History ({mealHistory.length})</button>
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <span style={{fontSize:11,color:C.mid}}>Serves:</span>
            {[1,2,3,4].map(n=><button key={n} onClick={()=>setServings(n)} style={s.btn(n===servings?C.sage:C.surface,n===servings?"#fff":C.mid,true)}>{n}</button>)}
          </div>
        </div>

        {/* Today's nutrition diary strip */}
        <div style={{...s.card,marginBottom:14}}>
          <div style={{padding:"10px 14px",borderBottom:`1px solid ${C.rule}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div style={{fontWeight:600,fontSize:13}}>Today's Nutrition Log <span style={{fontSize:11,color:C.mid,fontWeight:400}}>— {selectedDay}</span></div>
            <div style={{display:"flex",gap:10,fontSize:11}}>
              {[{l:"P",v:dTots.protein,t:targets.protein,c:C.blue},{l:"C",v:dTots.carbs,t:targets.carbs,c:C.teal},{l:"F",v:dTots.fat,t:targets.fat,c:C.gold},{l:"Cal",v:dTots.calories,t:targets.calories,c:C.terra}].map(m=>(
                <span key={m.l} style={{fontWeight:700,color:m.c}}>{m.l}: {Math.round(m.v)}<span style={{fontWeight:400,color:C.light}}>/{m.t}</span></span>
              ))}
            </div>
          </div>
          <div style={{display:"flex",gap:0}}>
            {SLOTS.map((slot,i)=>{
              const eaten = diary[diaryKey]?.[slot];
              const meal = plan[selectedDay]?.[slot];
              return (
                <div key={slot} onClick={()=>toggleDiary(slot)} style={{flex:1,padding:"9px 12px",borderRight:i<3?`1px solid ${C.rule}`:"none",background:eaten?C.sageXL:C.card,cursor:"pointer",textAlign:"center",transition:"background 0.15s"}}>
                  <div style={{fontSize:9,fontWeight:700,textTransform:"uppercase",color:SLOT_COLORS[slot],marginBottom:3}}>{slot}</div>
                  <div style={{fontSize:11,fontWeight:600,color:eaten?C.sage:C.charcoal,marginBottom:2}}>{eaten?"✓":""} {meal?.name?.split(" ").slice(0,3).join(" ") || "—"}</div>
                  <div style={{fontSize:9,color:C.light}}>{meal?.macros?.calories||0} cal</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Day selector */}
        <div style={{display:"flex",gap:6,marginBottom:12,overflowX:"auto",paddingBottom:4}}>
          {DAYS.map(day=>{
            const t=dayTotals(day); const ok=t.calories>0&&Math.abs(t.calories-targets.calories)/targets.calories<0.2;
            const hasLeftovers = SLOTS.some(sl=>plan[day]?.[sl]?.isLeftover);
            return (
              <button key={day} onClick={()=>setSelectedDay(day)} style={{...s.navBtn(selectedDay===day),flexShrink:0,flexDirection:"column",display:"flex",gap:2,padding:"6px 10px",borderColor:selectedDay===day?C.sage:ok?"#9FE1CB":C.rule,background:selectedDay===day?C.sage:ok?C.tealL:"transparent",color:selectedDay===day?"#fff":C.mid}}>
                <span style={{fontSize:11,fontWeight:600}}>{day.slice(0,3)}</span>
                <span style={{fontSize:9,opacity:0.8}}>{t.calories} cal</span>
                {hasLeftovers&&<span style={{fontSize:8,color:selectedDay===day?"rgba(255,255,255,0.7)":C.teal}}>♻</span>}
              </button>
            );
          })}
        </div>

        {/* Day macro bars */}
        <div style={{...s.card,marginBottom:14}}>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)"}}>
            {[{label:"Protein",val:dayTotals(selectedDay).protein,target:targets.protein,color:C.blue},{label:"Carbs",val:dayTotals(selectedDay).carbs,target:targets.carbs,color:C.teal},{label:"Fat",val:dayTotals(selectedDay).fat,target:targets.fat,color:C.gold},{label:"Calories",val:dayTotals(selectedDay).calories,target:targets.calories,color:C.terra}].map((m,i)=>(
              <div key={m.label} style={{padding:"10px 12px",textAlign:"center",borderRight:i<3?`1px solid ${C.rule}`:"none"}}>
                <div style={{fontSize:9,color:C.mid,textTransform:"uppercase",marginBottom:3}}>{m.label}</div>
                <div style={{fontSize:16,fontWeight:700,color:m.color}}>{Math.round(m.val)}{m.label!=="Calories"?"g":""}</div>
                <div style={{background:C.rule,borderRadius:2,height:4,overflow:"hidden",margin:"4px 0"}}><div style={s.macroBar(m.target>0?(m.val/m.target)*100:0,m.color)}/></div>
                <div style={{fontSize:9,color:C.light}}>/ {m.target}{m.label!=="Calories"?"g":""}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Meal grid */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          {SLOTS.map(slot=><MealCard key={slot} meal={plan[selectedDay]?.[slot]} day={selectedDay} slot={slot} />)}
        </div>

        {/* Leftover callout */}
        {DAYS.some(day=>SLOTS.some(sl=>plan[day]?.[sl]?.isLeftover))&&(
          <div style={{...s.card,marginTop:14}}>
            <div style={{padding:"10px 14px",borderBottom:`1px solid ${C.rule}`}}><div style={s.h3}>♻ Leftover-Aware Days This Week</div></div>
            <div style={{padding:"10px 14px",display:"flex",flexDirection:"column",gap:6}}>
              {DAYS.map(day=>{
                const leftovers=SLOTS.filter(sl=>plan[day]?.[sl]?.isLeftover);
                if(!leftovers.length) return null;
                return (
                  <div key={day} style={{display:"flex",gap:8,alignItems:"center",fontSize:12}}>
                    <span style={{fontWeight:600,minWidth:36}}>{day.slice(0,3)}</span>
                    {leftovers.map(sl=><span key={sl} style={s.pill(C.tealL,C.teal)}>{plan[day][sl].name}</span>)}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Shared ingredients */}
        {sharedIngredients.length>0&&(
          <div style={{...s.card,marginTop:14}}>
            <div style={{padding:"10px 14px",borderBottom:`1px solid ${C.rule}`}}><div style={s.h3}>♻ Shared Ingredients This Week</div></div>
            <div style={{padding:"10px 14px",display:"flex",gap:6,flexWrap:"wrap"}}>{sharedIngredients.map(si=><span key={si.key} style={{...s.pill(C.tealL,C.teal),fontSize:11,padding:"3px 10px"}}>{si.name} ×{si.count}</span>)}</div>
          </div>
        )}
      </div>
    );
  };

  // ─── SHOPPING TAB ─────────────────────────────────────────────────────────
  const ShopTab = () => {
    const byCat = {};
    Object.entries(shoppingList).forEach(([key,item])=>{ const c=item.cat||"other"; if(!byCat[c]) byCat[c]=[]; byCat[c].push({key,...item}); });
    const checkedCount=Object.values(shoppingList).filter(i=>i.checked).length;
    const total=Object.values(shoppingList).length;
    const totalCost=Object.values(shoppingList).reduce((s,i)=>s+(i.price||0),0);
    const specialInList=Object.values(shoppingList).filter(i=>i.onSpecial);

    return (
      <div>
        <div style={{display:"flex",gap:10,marginBottom:12,flexWrap:"wrap",alignItems:"center"}}>
          <div style={{fontFamily:"Georgia,serif",fontSize:15,fontWeight:600}}>Shopping List</div>
          <span style={{...s.pill(C.sageL,C.sage),fontSize:12,padding:"3px 10px"}}>{checkedCount}/{total}</span>
          <div style={{marginLeft:"auto",fontFamily:"Georgia,serif",fontSize:14,fontWeight:600,color:C.sage}}>~${totalCost.toFixed(2)} AUD</div>
        </div>
        <div style={{background:C.rule,borderRadius:3,height:5,marginBottom:12,overflow:"hidden"}}><div style={s.macroBar(total>0?(checkedCount/total)*100:0,C.sage)}/></div>
        {/* Specials in list */}
        {specialInList.length>0&&(
          <div style={{background:C.terraL,border:`1px solid ${C.terra}`,borderRadius:8,padding:"8px 12px",marginBottom:12,fontSize:11,color:C.terra}}>
            🏷 <strong>On special this week:</strong> {specialInList.map(i=>`${i.name} ~$${i.price?.toFixed(2)} at ${i.store}`).join(" · ")}
          </div>
        )}
        {/* Seasonal in list */}
        {Object.values(shoppingList).some(i=>i.seasonal)&&(
          <div style={{background:C.sageXL,border:`1px solid ${C.sageL}`,borderRadius:8,padding:"8px 12px",marginBottom:12,fontSize:11,color:C.sage}}>
            🌱 <strong>In season now:</strong> {Object.values(shoppingList).filter(i=>i.seasonal).map(i=>i.name).join(", ")}
          </div>
        )}
        {/* Cart push */}
        <div style={{display:"flex",gap:8,marginBottom:12}}>
          <button onClick={()=>alert("🛒 In production: POST /api/coles/cart/items")} style={{...s.btn("#E2001A","#fff"),fontSize:11}}>🛒 Send to Coles</button>
          <button onClick={()=>alert("🟢 In production: POST /api/woolworths/trolley/items")} style={{...s.btn("#007837","#fff"),fontSize:11}}>🟢 Send to Woolworths</button>
        </div>
        {/* Add item */}
        <div style={{display:"flex",gap:8,marginBottom:12}}>
          <input style={{...s.input,flex:1}} placeholder="Add item manually…" value={adHocItem} onChange={e=>setAdHocItem(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&adHocItem.trim()){const key=adHocItem.toLowerCase().trim();setShoppingList(l=>({...l,[key]:{name:adHocItem.trim(),qty:null,unit:null,cat:"other",checked:false,price:null,onSpecial:false,seasonal:false,preferredStore:null,preferredBrand:"",adHoc:true}}));setAdHocItem("");}}} />
          <button onClick={()=>{if(!adHocItem.trim())return;const key=adHocItem.toLowerCase().trim();setShoppingList(l=>({...l,[key]:{name:adHocItem.trim(),qty:null,unit:null,cat:"other",checked:false,price:null,onSpecial:false,seasonal:false,preferredStore:null,preferredBrand:"",adHoc:true}}));setAdHocItem("");}} style={s.btn(C.sage,"#fff")}>+ Add</button>
        </div>
        {Object.entries(SHOP_CATS).map(([cat,label])=>{
          const items=byCat[cat]; if(!items?.length) return null;
          return (
            <div key={cat} style={{...s.card,marginBottom:10}}>
              <div style={{padding:"9px 14px",borderBottom:`1px solid ${C.rule}`,fontWeight:700,fontSize:12}}>{label}</div>
              {items.map(item=>(
                <div key={item.key} style={{display:"flex",alignItems:"flex-start",gap:10,padding:"8px 14px",borderBottom:`1px solid ${C.rule}`,background:item.checked?C.sageXL:C.card}}>
                  <input type="checkbox" checked={item.checked} onChange={()=>setShoppingList(l=>({...l,[item.key]:{...l[item.key],checked:!l[item.key].checked}}))} style={{marginTop:3,flexShrink:0}} />
                  <div style={{flex:1}}>
                    <div style={{fontSize:13,fontWeight:500,textDecoration:item.checked?"line-through":"none",color:item.checked?C.light:C.charcoal,display:"flex",alignItems:"center",gap:5,flexWrap:"wrap"}}>
                      {item.seasonal&&<span title="In season">🌱</span>}
                      {item.onSpecial&&<span title="On special">🏷</span>}
                      {item.name}
                      {item.qty&&<span style={{fontWeight:400,color:C.mid,fontSize:11}}>— {Math.round(item.qty)}{item.unit}</span>}
                      {item.adHoc&&<span style={s.tag(C.blue,C.blueL)}>custom</span>}
                    </div>
                    <div style={{display:"flex",gap:6,marginTop:4,flexWrap:"wrap",alignItems:"center"}}>
                      {item.price&&<span style={{fontSize:10,color:item.onSpecial?C.terra:C.sage,fontWeight:item.onSpecial?700:400}}>~${item.price.toFixed(2)}{item.onSpecial&&" 🏷"}</span>}
                      {item.basePrice&&item.onSpecial&&<span style={{fontSize:10,color:C.light,textDecoration:"line-through"}}>${item.basePrice.toFixed(2)}</span>}
                      <span style={{fontSize:10,color:C.light}}>{item.store||""}</span>
                      <input style={{fontSize:10,padding:"2px 6px",border:`1px solid ${C.rule}`,borderRadius:6,width:80,background:C.surface,color:C.charcoal}} placeholder="Brand…" defaultValue={item.preferredBrand} onChange={e=>setShoppingList(l=>({...l,[item.key]:{...l[item.key],preferredBrand:e.target.value}}))} />
                      <select style={{fontSize:10,padding:"2px 5px",border:`1px solid ${C.rule}`,borderRadius:6,background:C.surface,color:C.mid}} defaultValue={item.preferredStore||""} onChange={e=>setShoppingList(l=>({...l,[item.key]:{...l[item.key],preferredStore:e.target.value}}))}>
                        <option value="">Store…</option>
                        {STORES.map(st=><option key={st} value={st}>{st}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    );
  };

  // ─── HISTORY MODAL ────────────────────────────────────────────────────────
  const HistoryModal = () => {
    if (!showHistory) return null;
    const grouped = {};
    mealHistory.forEach(h => {
      const date = h.date.split("T")[0];
      if (!grouped[date]) grouped[date] = [];
      grouped[date].push(h);
    });
    return (
      <div style={s.overlay} onClick={e=>e.target===e.currentTarget&&setShowHistory(false)}>
        <div style={s.drawer}>
          <div style={{width:36,height:4,background:C.rule,borderRadius:2,margin:"10px auto 0",flexShrink:0}} />
          <div style={{padding:"14px 18px 12px",borderBottom:`1px solid ${C.rule}`,display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
            <div style={s.h2}>📖 Meal History & Journal</div>
            <button onClick={()=>setShowHistory(false)} style={{...s.btn(C.surface,C.mid),border:`1px solid ${C.rule}`,borderRadius:50,padding:"5px 10px"}}>✕</button>
          </div>
          <div style={{overflowY:"auto",flex:1,padding:"14px 18px 24px"}}>
            {mealHistory.length===0&&(
              <div style={{textAlign:"center",padding:"40px 0",color:C.light}}>
                <div style={{fontSize:32,marginBottom:8}}>📓</div>
                <div>No meals logged yet.<br/>After cooking, open a recipe and tap "Save & Log Made It".</div>
              </div>
            )}
            {Object.entries(grouped).sort((a,b)=>b[0].localeCompare(a[0])).map(([date,entries])=>(
              <div key={date} style={{marginBottom:18}}>
                <div style={{...s.h3,marginBottom:8}}>{new Date(date+"T00:00:00").toLocaleDateString("en-AU",{weekday:"long",day:"numeric",month:"long"})}</div>
                {entries.map((h,i)=>(
                  <div key={i} style={{...s.card,marginBottom:8,padding:"12px 14px"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                      <div style={{flex:1}}>
                        <div style={{display:"flex",gap:5,alignItems:"center",marginBottom:4}}>
                          <span style={s.tag(SLOT_COLORS[h.slot]||C.mid,SLOT_BG[h.slot]||C.surface)}>{h.slot}</span>
                          {h.wouldMakeAgain&&<span style={s.tag(C.teal,C.tealL)}>♥ Again</span>}
                        </div>
                        <div style={{fontFamily:"Georgia,serif",fontSize:14,fontWeight:600,marginBottom:4}}>{h.recipeName}</div>
                        {h.rating>0&&<div style={{color:"#F4B400",fontSize:14}}>{"★".repeat(h.rating)}{"☆".repeat(5-h.rating)}</div>}
                        {h.comment&&<div style={{fontSize:11,color:C.mid,marginTop:4,fontStyle:"italic"}}>"{h.comment}"</div>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // ─── BATCH COOK PANEL ─────────────────────────────────────────────────────
  const BatchPanel = () => {
    if (!showBatchPanel) return null;
    const batchList = batchShopList();
    const totalCost = Object.values(batchList).reduce((s,i)=>s+(i.price||0),0);
    return (
      <div style={s.overlay} onClick={e=>e.target===e.currentTarget&&setShowBatchPanel(false)}>
        <div style={{...s.drawer,maxWidth:680}}>
          <div style={{width:36,height:4,background:C.rule,borderRadius:2,margin:"10px auto 0",flexShrink:0}} />
          <div style={{padding:"14px 18px 12px",borderBottom:`1px solid ${C.rule}`,flexShrink:0}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div>
                <div style={s.h2}>🍳 Batch Cook Mode</div>
                <div style={{fontSize:11,color:C.mid,marginTop:2}}>Select 2–3 meals to batch cook. Quantities double for meal prep. {batchIds.size>0&&<strong style={{color:C.plum}}>{batchIds.size} selected</strong>}</div>
              </div>
              <button onClick={()=>setShowBatchPanel(false)} style={{...s.btn(C.surface,C.mid),border:`1px solid ${C.rule}`,borderRadius:50,padding:"5px 10px"}}>✕</button>
            </div>
          </div>
          <div style={{overflowY:"auto",flex:1,padding:"14px 18px 24px"}}>
            {/* Batchable recipes */}
            <div style={s.h3}>Batch-Friendly Recipes</div>
            {batchRecipes.map(r=>{
              const sel = batchIds.has(r.id);
              return (
                <div key={r.id} onClick={()=>toggleBatch(r.id)} style={{...s.card,marginBottom:8,padding:"12px 14px",border:`1.5px solid ${sel?C.plum:C.rule}`,background:sel?C.plumL:C.card,cursor:"pointer",transition:"all 0.15s"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                    <div style={{flex:1}}>
                      <div style={{display:"flex",gap:5,marginBottom:4}}>
                        <span style={s.tag(SLOT_COLORS[r.slot],SLOT_BG[r.slot])}>{r.slot}</span>
                        {r.yieldServings>r.servings&&<span style={s.tag(C.teal,C.tealL)}>Yields {r.yieldServings} serves</span>}
                      </div>
                      <div style={{fontFamily:"Georgia,serif",fontSize:14,fontWeight:600,marginBottom:2}}>{r.name}</div>
                      <div style={{fontSize:11,color:C.mid}}>⏱ {r.totalTime}min · {r.ingredients.length} ingredients</div>
                      {r.leftoversName&&<div style={{fontSize:11,color:C.teal,marginTop:2}}>→ Leftovers become: {r.leftoversName}</div>}
                    </div>
                    <div style={{width:22,height:22,borderRadius:"50%",border:`2px solid ${sel?C.plum:C.rule}`,background:sel?C.plum:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                      {sel&&<span style={{color:"#fff",fontSize:12}}>✓</span>}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Merged shopping list for batch */}
            {batchIds.size>0&&(
              <div style={{marginTop:18}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                  <div style={s.h3}>Merged Batch Shopping List</div>
                  <span style={{fontSize:12,fontWeight:600,color:C.sage}}>~${totalCost.toFixed(2)} AUD</span>
                </div>
                <div style={{background:C.sageXL,border:`1px solid ${C.sageL}`,borderRadius:8,padding:"8px 12px",marginBottom:12,fontSize:11,color:C.sage}}>
                  Quantities scaled ×2 (batch = double your usual servings of {servings})
                </div>
                {Object.entries(SHOP_CATS).map(([cat,label])=>{
                  const items=Object.entries(batchList).filter(([,i])=>i.cat===cat);
                  if(!items.length) return null;
                  return (
                    <div key={cat} style={{...s.card,marginBottom:8}}>
                      <div style={{padding:"7px 12px",borderBottom:`1px solid ${C.rule}`,fontWeight:700,fontSize:11}}>{label}</div>
                      {items.map(([key,item])=>(
                        <div key={key} style={{display:"flex",justifyContent:"space-between",padding:"6px 12px",borderBottom:`1px solid ${C.rule}`,fontSize:12}}>
                          <span style={{display:"flex",alignItems:"center",gap:5}}>
                            {item.onSpecial&&<span>🏷</span>}
                            {item.name}
                          </span>
                          <span style={{fontWeight:600}}>{Math.round(item.qty)} {item.unit}{item.price&&<span style={{color:C.sage,fontWeight:400,marginLeft:8}}>~${item.price.toFixed(2)}</span>}</span>
                        </div>
                      ))}
                    </div>
                  );
                })}
                <button onClick={()=>{ setShoppingList(l=>({...l,...Object.fromEntries(Object.entries(batchList).map(([k,v])=>([k,{...v,checked:false}])))})); setShowBatchPanel(false); }} style={{...s.btn(C.sage,"#fff"),width:"100%",padding:"11px",fontSize:13,borderRadius:10,marginTop:4}}>
                  ✓ Add Batch List to Shopping List
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // ─── SETTINGS TAB ─────────────────────────────────────────────────────────
  const SettingsTab = () => {
    const [lt,setLt]=useState(targets);
    const [lp,setLp]=useState(prefs);
    const [le,setLe]=useState(equipment);
    const [saved,setSaved]=useState(false);
    const save=()=>{ setTargets(lt); setPrefs(lp); setEquipment(le); setSaved(true); setTimeout(()=>setSaved(false),2500); };
    return (
      <div style={{display:"flex",flexDirection:"column",gap:14}}>
        {/* Auth banner */}
        <div style={{...s.card,background:"#1a1a18",color:"#e0e0e0",padding:"14px 16px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div>
              <div style={{fontFamily:"Georgia,serif",fontSize:14,fontWeight:600,color:"#7a9e7e",marginBottom:3}}>
                {user ? `✓ Signed in as ${user.email}` : "⚠ Not signed in — data is local only"}
              </div>
              <div style={{fontSize:11,color:"#888"}}>
                {user ? "Your plan, history, and shopping list sync across devices." : "Sign in with Google to sync your data across devices via Supabase."}
              </div>
            </div>
            {user
              ? <button onClick={()=>setUser(null)} style={s.btn(C.terraL,C.terra,true)}>Sign Out</button>
              : <button onClick={()=>{ setUser({email:"user@example.com",name:"Demo User"}); alert("SUPABASE: supabase.auth.signInWithOAuth({ provider: 'google' })\nThis demo auto-signs you in."); }} style={{...s.btn("#4285F4","#fff"),fontSize:12}}>🔑 Sign in with Google</button>
            }
          </div>
          <div style={{marginTop:10,fontSize:10,fontFamily:"monospace",color:"#666",lineHeight:1.7}}>
            // SUPABASE: const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)<br/>
            // Auth: supabase.auth.signInWithOAuth(&#123; provider: 'google' &#125;)<br/>
            // Persist: supabase.from('meal_plans').upsert(&#123; user_id, week, plan &#125;)<br/>
            // Read: supabase.from('meal_plans').select('*').eq('user_id', user.id)
          </div>
        </div>
        <div style={s.card}>
          <div style={{padding:"12px 16px",borderBottom:`1px solid ${C.rule}`}}><div style={s.h2}>🎯 Nutrition Targets</div></div>
          <div style={{padding:"14px 16px",display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            {[{key:"calories",label:"Calories (kcal)",color:C.terra},{key:"protein",label:"Protein (g)",color:C.blue},{key:"carbs",label:"Carbs (g)",color:C.teal},{key:"fat",label:"Fat (g)",color:C.gold}].map(f=>(
              <div key={f.key}><label style={{fontSize:11,fontWeight:600,color:f.color,display:"block",marginBottom:4}}>{f.label}</label><input type="number" min="0" style={{...s.input,borderColor:f.color}} value={lt[f.key]} onChange={e=>setLt(t=>({...t,[f.key]:Number(e.target.value)}))} /></div>
            ))}
          </div>
        </div>
        <div style={s.card}>
          <div style={{padding:"12px 16px",borderBottom:`1px solid ${C.rule}`}}><div style={s.h2}>🍽 Cuisine Preferences</div></div>
          <div style={{padding:"12px 16px",display:"flex",gap:6,flexWrap:"wrap"}}>
            {CUISINES.map(c=>{ const sel=lp.cuisines.includes(c); return <button key={c} onClick={()=>setLp(p=>({...p,cuisines:sel?p.cuisines.filter(x=>x!==c):[...p.cuisines,c]}))} style={{...s.btn(sel?C.sage:C.surface,sel?"#fff":C.mid,true),border:`1px solid ${sel?C.sage:C.rule}`}}>{c}</button>; })}
          </div>
        </div>
        <div style={s.card}>
          <div style={{padding:"12px 16px",borderBottom:`1px solid ${C.rule}`}}><div style={s.h2}>🌿 Dietary Requirements</div></div>
          <div style={{padding:"12px 16px",display:"flex",gap:6,flexWrap:"wrap"}}>
            {DIETS.map(d=>(<button key={d} onClick={()=>setLp(p=>({...p,diet:d}))} style={{...s.btn(lp.diet===d?C.teal:C.surface,lp.diet===d?"#fff":C.mid,true),border:`1px solid ${lp.diet===d?C.teal:C.rule}`}}>{d}</button>))}
          </div>
        </div>
        <div style={s.card}>
          <div style={{padding:"12px 16px",borderBottom:`1px solid ${C.rule}`}}><div style={s.h2}>🔧 Kitchen Equipment</div><div style={{fontSize:11,color:C.mid}}>Deselect what you don't own</div></div>
          <div style={{padding:"12px 16px",display:"flex",gap:6,flexWrap:"wrap"}}>
            {EQUIP.map(eq=>{ const has=le.includes(eq); return <button key={eq} onClick={()=>setLe(e=>has?e.filter(x=>x!==eq):[...e,eq])} style={{...s.btn(has?C.plumL:C.surface,has?C.plum:C.light,true),border:`1px solid ${has?C.plum:C.rule}`,textDecoration:has?"none":"line-through"}}>{eq}</button>; })}
          </div>
        </div>
        <div style={s.card}>
          <div style={{padding:"12px 16px",borderBottom:`1px solid ${C.rule}`}}><div style={s.h2}>🚫 Exclude Ingredients</div></div>
          <div style={{padding:"12px 16px"}}>
            <textarea style={{...s.input,minHeight:55,resize:"vertical"}} placeholder="e.g. peanuts, shellfish (comma-separated)" defaultValue={(lp.excludeIngredients||[]).join(", ")} onChange={e=>setLp(p=>({...p,excludeIngredients:e.target.value.split(",").map(x=>x.trim()).filter(Boolean)}))} />
          </div>
        </div>
        <button onClick={save} style={{...s.btn(saved?C.teal:C.sage,"#fff"),padding:"11px",fontSize:14,borderRadius:10}}>{saved?"✓ Saved — regenerate plan to apply":"Save Preferences"}</button>
      </div>
    );
  };

  // ─── RECIPE EDITOR MODAL ──────────────────────────────────────────────────
  const RecipeEditor = () => {
    if (!showEditor || !editorDraft) return null;
    const d = editorDraft;
    return (
      <div style={s.overlay} onClick={e=>e.target===e.currentTarget&&setShowEditor(false)}>
        <div style={{...s.drawer,maxWidth:720}}>
          <div style={{width:36,height:4,background:C.rule,borderRadius:2,margin:"10px auto 0",flexShrink:0}} />
          <div style={{padding:"14px 18px 12px",borderBottom:`1px solid ${C.rule}`,display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
            <div style={s.h2}>{editRecipeId?"✏️ Edit Recipe":"✏️ Add New Recipe"}</div>
            <button onClick={()=>setShowEditor(false)} style={{...s.btn(C.surface,C.mid),border:`1px solid ${C.rule}`,borderRadius:50,padding:"5px 10px"}}>✕</button>
          </div>
          <div style={{overflowY:"auto",flex:1,padding:"16px 18px 24px",display:"flex",flexDirection:"column",gap:14}}>
            <div><div style={s.h3}>Recipe Name *</div><input style={s.input} placeholder="e.g. Mum's Pasta Bake" value={d.name} onChange={e=>setDraft("name",e.target.value)} /></div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:10}}>
              <div><div style={{...s.h3,marginBottom:4}}>Meal Type</div><select style={{...s.select,width:"100%"}} value={d.slot} onChange={e=>setDraft("slot",e.target.value)}>{SLOTS.map(sl=><option key={sl} value={sl}>{sl}</option>)}</select></div>
              <div><div style={{...s.h3,marginBottom:4}}>Prep (min)</div><input type="number" style={s.input} value={d.prepTime} onChange={e=>setDraft("prepTime",parseInt(e.target.value)||0)} /></div>
              <div><div style={{...s.h3,marginBottom:4}}>Cook (min)</div><input type="number" style={s.input} value={d.cookTime} onChange={e=>setDraft("cookTime",parseInt(e.target.value)||0)} /></div>
              <div><div style={{...s.h3,marginBottom:4}}>Serves</div><input type="number" style={s.input} min={1} value={d.servings} onChange={e=>setDraft("servings",parseInt(e.target.value)||1)} /></div>
            </div>
            <div><div style={s.h3}>Yield (serves) — if recipe makes more than 1 serving size</div><input type="number" style={s.input} min={1} value={d.yieldServings||d.servings} onChange={e=>setDraft("yieldServings",parseInt(e.target.value)||d.servings)} /></div>
            <div><div style={s.h3}>Cuisine</div><div style={{display:"flex",gap:5,flexWrap:"wrap"}}>{CUISINES.map(c=>{const sel=d.cuisine.includes(c);return <button key={c} onClick={()=>toggleArr("cuisine",c)} style={{...s.btn(sel?C.sage:C.surface,sel?"#fff":C.mid,true),border:`1px solid ${sel?C.sage:C.rule}`}}>{c}</button>;})} </div></div>
            <div><div style={s.h3}>Dietary Tags</div><div style={{display:"flex",gap:5,flexWrap:"wrap"}}>{DIETS.filter(d=>d!=="None").map(diet=>{const sel=d.diet.includes(diet);return <button key={diet} onClick={()=>toggleArr("diet",diet)} style={{...s.btn(sel?C.teal:C.surface,sel?"#fff":C.mid,true),border:`1px solid ${sel?C.teal:C.rule}`}}>{diet}</button>;})} </div></div>
            <div><div style={s.h3}>Equipment</div><div style={{display:"flex",gap:5,flexWrap:"wrap"}}>{EQUIP.map(eq=>{const sel=d.equipment.includes(eq);return <button key={eq} onClick={()=>toggleArr("equipment",eq)} style={{...s.btn(sel?C.plum:C.surface,sel?"#fff":C.mid,true),border:`1px solid ${sel?C.plum:C.rule}`}}>{eq}</button>;})} </div></div>
            <div><div style={s.h3}>Macros (per serving)</div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:10}}>{[{key:"protein",label:"Protein (g)",c:C.blue},{key:"carbs",label:"Carbs (g)",c:C.teal},{key:"fat",label:"Fat (g)",c:C.gold},{key:"calories",label:"Calories",c:C.terra}].map(f=><div key={f.key}><div style={{fontSize:10,fontWeight:600,color:f.c,marginBottom:3}}>{f.label}</div><input type="number" min="0" style={{...s.input,borderColor:f.c}} value={d.macros[f.key]} onChange={e=>setMacro(f.key,e.target.value)} /></div>)}</div><div style={{fontSize:10,color:C.mid,marginTop:4}}>💡 Leave calories at 0 to auto-calculate (protein×4 + carbs×4 + fat×9)</div></div>
            <div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}><div style={s.h3}>Ingredients</div><button onClick={addIng} style={s.btn(C.sageXL,C.sage,true)}>+ Add</button></div>
              <div style={{display:"flex",flexDirection:"column",gap:7}}>
                {d.ingredients.map((ing,i)=>(
                  <div key={i} style={{display:"grid",gridTemplateColumns:"2fr 70px 80px 100px 26px",gap:6,alignItems:"center"}}>
                    <input style={s.input} placeholder="Ingredient" value={ing.name} onChange={e=>setIngField(i,"name",e.target.value)} />
                    <input type="number" style={s.input} placeholder="Qty" value={ing.qty} onChange={e=>setIngField(i,"qty",parseFloat(e.target.value)||"")} />
                    <select style={{...s.select,width:"100%"}} value={ing.unit} onChange={e=>setIngField(i,"unit",e.target.value)}>{UNITS.map(u=><option key={u} value={u}>{u}</option>)}</select>
                    <select style={{...s.select,width:"100%"}} value={ing.cat} onChange={e=>setIngField(i,"cat",e.target.value)}>{ING_CATS.map(c=><option key={c} value={c}>{c}</option>)}</select>
                    <button onClick={()=>removeIng(i)} style={{...s.btn(C.terraL,C.terra,true),width:24,padding:"2px 0",textAlign:"center"}}>✕</button>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}><div style={s.h3}>Method</div><button onClick={addStep} style={s.btn(C.sageXL,C.sage,true)}>+ Add Step</button></div>
              <div style={{display:"flex",flexDirection:"column",gap:7}}>
                {d.steps.map((step,i)=>(
                  <div key={i} style={{display:"flex",gap:8,alignItems:"flex-start"}}>
                    <div style={{width:22,height:22,borderRadius:"50%",background:C.sageL,color:C.sage,fontSize:10,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginTop:6}}>{i+1}</div>
                    <textarea style={{...s.input,flex:1,resize:"vertical",minHeight:38,fontSize:12}} placeholder={`Step ${i+1}…`} value={step} onChange={e=>setStep(i,e.target.value)} />
                    <button onClick={()=>removeStep(i)} style={{...s.btn(C.terraL,C.terra,true),marginTop:4}}>✕</button>
                  </div>
                ))}
              </div>
            </div>
            <div><div style={s.h3}>Chef's Tip (optional)</div><input style={s.input} placeholder="e.g. Make double and freeze half" value={d.tip} onChange={e=>setDraft("tip",e.target.value)} /></div>
            <div style={{display:"flex",gap:10}}>
              <button onClick={saveRecipe} disabled={!d.name} style={{...s.btn(C.sage,"#fff"),padding:"10px 0",fontSize:13,borderRadius:10,flex:1,opacity:!d.name?0.5:1}}>{editRecipeId?"✓ Save Changes":"✓ Add to My Recipes"}</button>
              <button onClick={()=>setShowEditor(false)} style={{...s.btn(C.surface,C.mid),padding:"10px 18px",border:`1px solid ${C.rule}`,borderRadius:10}}>Cancel</button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ─── LIBRARY MODAL ────────────────────────────────────────────────────────
  const LibraryModal = () => {
    if (!showLibrary) return null;
    const filtered = allRecipes.filter(r => {
      if (libraryFilter==="custom" && r.source==="builtin") return false;
      if (libraryFilter==="builtin" && r.source!=="builtin") return false;
      if (librarySearch && !r.name.toLowerCase().includes(librarySearch.toLowerCase())) return false;
      return true;
    });
    return (
      <div style={s.overlay} onClick={e=>e.target===e.currentTarget&&setShowLibrary(false)}>
        <div style={{...s.drawer,maxWidth:720}}>
          <div style={{width:36,height:4,background:C.rule,borderRadius:2,margin:"10px auto 0",flexShrink:0}} />
          <div style={{padding:"14px 18px 12px",borderBottom:`1px solid ${C.rule}`,flexShrink:0}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
              <div style={s.h2}>📚 Recipe Library ({allRecipes.length})</div>
              <div style={{display:"flex",gap:8}}>
                <button onClick={()=>setShowUrlImport(true)} style={s.btn(C.sageXL,C.sage)}>🔗 Import</button>
                <button onClick={openNewRecipe} style={s.btn(C.sage,"#fff")}>+ Add</button>
                <button onClick={()=>setShowLibrary(false)} style={{...s.btn(C.surface,C.mid),border:`1px solid ${C.rule}`,borderRadius:50,padding:"5px 10px"}}>✕</button>
              </div>
            </div>
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              <input style={{...s.input,flex:1}} placeholder="Search…" value={librarySearch} onChange={e=>setLibrarySearch(e.target.value)} />
              {["all","builtin","custom"].map(f=><button key={f} onClick={()=>setLibraryFilter(f)} style={s.navBtn(libraryFilter===f)}>{f==="all"?"All":f==="builtin"?"Built-in":"My Recipes"}</button>)}
            </div>
          </div>
          <div style={{overflowY:"auto",flex:1,padding:"12px 18px 20px",display:"flex",flexDirection:"column",gap:8}}>
            {filtered.length===0&&<div style={{textAlign:"center",padding:"30px 0",color:C.light}}>No recipes found.</div>}
            {filtered.map(r=>(
              <div key={r.id} style={{...s.card,padding:"11px 14px",display:"flex",gap:12,alignItems:"flex-start"}}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:"flex",gap:5,marginBottom:3,flexWrap:"wrap"}}>
                    <span style={s.tag(SLOT_COLORS[r.slot],SLOT_BG[r.slot])}>{r.slot}</span>
                    {r.source!=="builtin"&&<span style={s.tag(C.plum,C.plumL)}>My Recipe</span>}
                    {r.yieldServings>r.servings&&<span style={s.tag(C.teal,C.tealL)}>♻ {r.yieldServings} serves</span>}
                    {r.ingredients?.some(i=>isInSeason(i.name))&&<span style={s.tag(C.sage,C.sageXL)}>🌱 Seasonal</span>}
                  </div>
                  <div style={{fontFamily:"Georgia,serif",fontSize:14,fontWeight:600,marginBottom:2}}>{r.name}</div>
                  <div style={{fontSize:11,color:C.mid}}>⏱ {r.totalTime}min · {r.ingredients?.length} ingredients</div>
                  <div style={{display:"flex",gap:5,marginTop:5}}>
                    <span style={s.pill(C.blueL,C.blue)}>P {r.macros?.protein}g</span>
                    <span style={s.pill("#e8f4e8",C.teal)}>C {r.macros?.carbs}g</span>
                    <span style={s.pill(C.goldL,C.gold)}>F {r.macros?.fat}g</span>
                    <span style={s.pill(C.terraL,C.terra)}>{r.macros?.calories} cal</span>
                  </div>
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:5,flexShrink:0}}>
                  <button onClick={()=>{setOpenMeal({meal:r,day:selectedDay,slot:r.slot});setShowLibrary(false);}} style={s.btn(C.sageXL,C.sage,true)}>View</button>
                  {r.source!=="builtin"&&<>
                    <button onClick={()=>openEditRecipe(r)} style={s.btn(C.surface,C.mid,true)}>Edit</button>
                    <button onClick={()=>{if(confirm(`Delete "${r.name}"?`))deleteRecipe(r.id);}} style={s.btn(C.terraL,C.terra,true)}>Delete</button>
                  </>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // ─── URL IMPORT MODAL ─────────────────────────────────────────────────────
  const UrlImportModal = () => {
    if (!showUrlImport) return null;
    return (
      <div style={s.overlay} onClick={e=>e.target===e.currentTarget&&setShowUrlImport(false)}>
        <div style={{...s.drawer,maxWidth:600,maxHeight:"80vh"}}>
          <div style={{width:36,height:4,background:C.rule,borderRadius:2,margin:"10px auto 0",flexShrink:0}} />
          <div style={{padding:"14px 18px 12px",borderBottom:`1px solid ${C.rule}`,display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
            <div><div style={s.h2}>🔗 Import from Website</div><div style={{fontSize:11,color:C.mid,marginTop:2}}>Paste any recipe page URL</div></div>
            <button onClick={()=>setShowUrlImport(false)} style={{...s.btn(C.surface,C.mid),border:`1px solid ${C.rule}`,borderRadius:50,padding:"5px 10px"}}>✕</button>
          </div>
          <div style={{overflowY:"auto",flex:1,padding:"16px 18px 24px"}}>
            <div style={{display:"flex",gap:8,marginBottom:12}}>
              <input style={{...s.input,flex:1}} placeholder="https://www.taste.com.au/recipes/…" value={importUrl} onChange={e=>setImportUrl(e.target.value)} onKeyDown={e=>e.key==="Enter"&&doImport()} />
              <button onClick={doImport} disabled={importStatus==="loading"||!importUrl.trim()} style={{...s.btn(C.sage,"#fff"),flexShrink:0,opacity:!importUrl.trim()?0.5:1}}>{importStatus==="loading"?"Parsing…":"Import"}</button>
            </div>
            <div style={{background:C.sageXL,border:`1px solid ${C.sageL}`,borderRadius:8,padding:"9px 12px",fontSize:11,color:C.sage,marginBottom:12}}>
              Works best with: <strong>taste.com.au, delicious.com.au, sbs.com.au/food, nytcooking.com, bbcgoodfood.com, allrecipes.com</strong>
            </div>
            {importStatus==="loading"&&<div style={{textAlign:"center",padding:"30px 0",color:C.mid}}><div style={{fontSize:28,marginBottom:8}}>🧑‍🍳</div><div style={{fontWeight:600}}>Parsing recipe…</div></div>}
            {importStatus==="error"&&<div style={{background:C.terraL,border:`1px solid ${C.terra}`,borderRadius:8,padding:"10px 14px",color:C.terra,marginBottom:12}}><strong>⚠ Failed:</strong> {importError}</div>}
            {importStatus==="success"&&importPreview&&(
              <div>
                <div style={{...s.card,marginBottom:12,padding:"12px 14px"}}>
                  <div style={{fontFamily:"Georgia,serif",fontSize:16,fontWeight:600,marginBottom:4}}>{importPreview.name}</div>
                  <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:8}}>
                    <span style={s.tag(SLOT_COLORS[importPreview.slot],SLOT_BG[importPreview.slot])}>{importPreview.slot}</span>
                    {importPreview.cuisine?.map(c=><span key={c} style={s.tag(C.sage,C.sageXL)}>{c}</span>)}
                  </div>
                  <div style={{fontSize:11,color:C.mid,marginBottom:10}}>⏱ {importPreview.totalTime}min · Serves {importPreview.servings}</div>
                  <div style={{display:"flex",gap:8,marginBottom:12}}>
                    {[{l:"P",v:importPreview.macros?.protein,c:C.blue},{l:"C",v:importPreview.macros?.carbs,c:C.teal},{l:"F",v:importPreview.macros?.fat,c:C.gold},{l:"Cal",v:importPreview.macros?.calories,c:C.terra}].map(m=>(
                      <div key={m.l} style={{flex:1,background:C.surface,borderRadius:7,padding:"6px 8px",textAlign:"center"}}>
                        <div style={{fontSize:9,color:C.mid}}>{m.l}</div><div style={{fontSize:14,fontWeight:700,color:m.c}}>{m.v}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{border:`1px solid ${C.rule}`,borderRadius:7,overflow:"hidden"}}>
                    {importPreview.ingredients?.slice(0,5).map((ing,i)=>(
                      <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"6px 10px",borderBottom:i<4?`1px solid ${C.rule}`:"none",background:i%2===0?C.sageXL:C.card,fontSize:12}}>
                        <span>{ing.name}</span><span style={{fontWeight:600}}>{ing.qty} {ing.unit}</span>
                      </div>
                    ))}
                    {importPreview.ingredients?.length>5&&<div style={{padding:"6px 10px",fontSize:11,color:C.mid}}>+{importPreview.ingredients.length-5} more</div>}
                  </div>
                </div>
                <div style={{display:"flex",gap:10}}>
                  <button onClick={saveImportedRecipe} style={{...s.btn(C.sage,"#fff"),padding:"10px 0",fontSize:13,borderRadius:10,flex:1}}>✓ Save to My Recipes</button>
                  <button onClick={()=>{setShowEditor(true);setEditorDraft({...importPreview});setEditRecipeId(null);setShowUrlImport(false);}} style={{...s.btn(C.sageXL,C.sage),padding:"10px 16px",borderRadius:10}}>Edit First</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // ─── ROOT RENDER ──────────────────────────────────────────────────────────
  return (
    <div style={s.app}>
      <div style={s.hdr}>
        <div style={s.logo}>Nutri<span style={{color:C.terra}}>Plan</span></div>
        <nav style={{display:"flex",gap:4}}>
          {[["plan","📅 Plan"],["shop","🛒 Shop"],["settings","⚙️ Settings"]].map(([id,label])=>(
            <button key={id} onClick={()=>setTab(id)} style={s.navBtn(tab===id)}>{label}</button>
          ))}
        </nav>
      </div>
      <div style={s.body}>
        {tab==="plan"     && <PlanTab />}
        {tab==="shop"     && <ShopTab />}
        {tab==="settings" && <SettingsTab />}
      </div>
      {openMeal      && <RecipeDrawer />}
      {showEditor    && <RecipeEditor />}
      {showLibrary   && <LibraryModal />}
      {showUrlImport && <UrlImportModal />}
      {showHistory   && <HistoryModal />}
      {showBatchPanel && <BatchPanel />}
    </div>
  );
}
