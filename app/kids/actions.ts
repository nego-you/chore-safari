"use server";

// app/kids/actions.ts — re-export barrel
// Implementation has been moved to features/ sub-modules.
// All exports are re-exported here to avoid breaking existing import paths.
//
// For new code, import directly from features/:
//   import { playCraneGame } from "@/features/crane/actions";
//   import { playGacha }     from "@/features/gacha/actions";
//   import { setTrap }       from "@/features/safari/actions";
//   import { craftItem }     from "@/features/craft/actions";
//   import { submitQuest }   from "@/features/quest/actions";
//   import { betOnRace }     from "@/features/race/actions";
//   import { getUnreadBonusNotifications } from "@/features/notifications/actions";

export * from "@/features/crane/actions";
export * from "@/features/gacha/actions";
export * from "@/features/safari/actions";
export * from "@/features/craft/actions";
export * from "@/features/quest/actions";
export * from "@/features/race/actions";
export * from "@/features/notifications/actions";
