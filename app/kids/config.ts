// /kids 配下で共有する設定値。
// "use server" の actions.ts からは async 関数以外を export できないため、
// 定数はここに分離してサーバ/クライアント双方から import できるようにしておく。

export const GACHA_COST = 100;
