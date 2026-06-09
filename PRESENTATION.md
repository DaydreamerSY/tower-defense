# Shuriken Prototype — Nội dung thuyết trình

> Mỗi `##` là 1 slide gợi ý. Số liệu lấy đúng từ `config.js > DEFAULT_SKILLS`.

---

## Slide 1 — Game là gì
- **Auto-shooter survival / roguelike**: player đứng giữa, **tự bắn** kẻ thù gần nhất, né va chạm (chạm = thua).
- Enemy **mạnh dần theo thời gian**; sống càng lâu càng khó.
- Hạ kẻ thù → nhận **EXP** → đầy thanh → **lên cấp → chọn 1 trong 3 kỹ năng** (kiểu Vampire Survivors).
- Điểm nhấn cơ chế: **đạn nảy** (bounce) + **hệ nguyên tố** kết hợp đa hệ trên cùng 1 viên.

## Slide 2 — Vòng lặp chơi
1. Bắn tự động (auto-aim mô phỏng đường đạn → chọn góc trúng nhiều địch nhất).
2. Hạ địch → EXP (mỗi loại địch cho lượng khác nhau: tam giác 2 · tròn 3 · vuông 5).
3. Lên cấp → bốc ngẫu nhiên 3 kỹ năng → chọn 1.
4. Skill xếp theo **hệ** (Lửa/Gió/Đất/Điện) + **Phụ trợ**; mỗi skill **5 mốc** (riêng Tách rời 1 mốc).

---

## Slide 3 — Concept: vì sao chia hệ như vậy
Mỗi hệ có **một vai trò (fantasy) rõ ràng** để người chơi build theo hướng mình thích:

| Hệ | Vai trò thiết kế | Lý do / cảm giác |
|---|---|---|
| 🔥 **Lửa** | **Sát thương** (đặc biệt DoT) | Cháy cộng dồn vô hạn — càng nhiều stack càng "tan chảy"; thưởng cho lối chơi dồn sát thương theo thời gian. |
| 💨 **Gió** | **Cơ động & xuyên/đẩy** | Xuyên nhiều địch, đẩy đám đông ra xa, đạn nhanh & nảy nhiều — kiểm soát vị trí, giải vây. |
| 🪨 **Đất** | **Phòng thủ & khống chế khu vực** | Vũng bùn làm chậm, đẩy lùi, dựng tường chắn — tạo không gian an toàn, "zone control". |
| ⚡ **Điện** | **Đánh lan & khống chế cứng** | Sét nhảy dây chuyền nhiều mục tiêu + tê liệt (đứng hình) — mạnh khi đông địch, combo CC. |
| ✨ **Phụ trợ** | **Khuếch đại & tiện ích** | Crit, tốc độ, nhân đạn, EXP, tường — không gắn hệ, ghép vào mọi build. |

> **Chủ đề xuyên suốt — "Nảy (Bounce)"**: mỗi hệ có thêm 1 kỹ năng kích hoạt **mỗi khi đạn nảy** → khuyến khích build tăng số lần nảy để "bùng" hiệu ứng liên hoàn.

---

## Slide 4 — 🔥 Hệ LỬA (Sát thương / DoT)
**Concept:** nguồn damage chính, đốt theo thời gian, càng đánh càng cộng dồn.

**Bỏng** *(mỗi đòn trúng +1 stack, cộng dồn vô hạn, mỗi stack có timer riêng)*
| Mốc | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|
| dmg/giây mỗi stack | 1 | 1 | 2 | 2 | 3 |
| Thời gian | 6s | 8s | 8s | 10s | 10s |

**Đạn lửa** *(% viên hóa lửa, +sát thương)*
| Mốc | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|
| Tỉ lệ | 15% | 22% | 30% | 40% | 50% |
| +Sát thương | 1 | 1 | 2 | 2 | 3 |

**Lửa Dội** *(mỗi lần đạn NẢY → nổ lửa AoE tại điểm nảy)*
| Mốc | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|
| Bán kính | 50 | 60 | 70 | 80 | 90 |
| Sát thương | 1 | 1 | 2 | 2 | 3 |

**Vệt Lửa** *(mỗi lần NẢY → để lại vệt lửa dài (capsule) đốt máu)*
| Mốc | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|
| Dài | 90 | 110 | 130 | 150 | 170 |
| Dày | 18 | 20 | 22 | 24 | 26 |
| dmg/giây | 1 | 1 | 2 | 2 | 3 |
| Thời gian | 2s | 2s | 2.5s | 3s | 3s |

---

## Slide 5 — 💨 Hệ GIÓ (Cơ động / xuyên / đẩy)
**Concept:** kiểm soát vị trí — xuyên qua địch, hất đám đông ra xa, đạn nhanh & nảy nhiều.

**Đạn gió** *(% viên xuyên thêm địch — đi thẳng thay vì nảy)*
| Mốc | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|
| Tỉ lệ | 15% | 22% | 30% | 40% | 50% |
| +Xuyên | 1 | 1 | 2 | 2 | 3 |

**Luồng gió** *(cứ N phát bắn → đẩy địch quanh player ra rìa bán kính)*
| Mốc | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|
| Mỗi N phát | 100 | 80 | 60 | 45 | 30 |
| Bán kính đẩy | 240 | 270 | 300 | 330 | 360 |

**Gió Dội** *(mỗi lần NẢY → +lần nảy & viên đạn tăng tốc)*
| Mốc | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|
| +Số lần nảy | 1 | 1 | 2 | 2 | 3 |
| Tăng tốc mỗi lần nảy | 10% | 15% | 15% | 20% | 25% |

**Cuồng Phong** *(mỗi lần NẢY → luồng gió đẩy địch quanh điểm nảy)*
| Mốc | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|
| Bán kính đẩy | 90 | 110 | 130 | 150 | 180 |

---

## Slide 6 — 🪨 Hệ ĐẤT (Phòng thủ / khống chế khu vực)
**Concept:** tạo vùng an toàn — làm chậm, đẩy lùi, dựng vật cản.

**Đạn đất** *(% viên → vũng bùn làm chậm địch đứng trong)*
| Mốc | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|
| Tỉ lệ | 15% | 22% | 30% | 40% | 50% |
| Bán kính | 60 | 70 | 80 | 90 | 100 |
| Còn % tốc độ | 55% | 50% | 45% | 40% | 35% |
| Thời gian | 3s | 3s | 3.5s | 4s | 4s |

**Đạn nặng** *(mọi viên đẩy lùi địch khi trúng — đánh đổi: tốc độ bay −20%)*
| Mốc | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|
| Đẩy lùi (px) | 30 | 45 | 60 | 80 | 100 |
| Tốc độ bay | −20% | −20% | −20% | −20% | −20% |

**Đá Dội** *(mỗi lần NẢY → viên đạn được cộng thêm sát thương, mạnh dần)*
| Mốc | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|
| +Sát thương / lần nảy | 1 | 1 | 2 | 2 | 3 |

> *(Hệ Đất còn có **Tường Nảy** ở nhóm Phụ trợ — Slide 8: dựng tường chắn địch + cho đạn nảy.)*

---

## Slide 7 — ⚡ Hệ ĐIỆN (Đánh lan / khống chế cứng)
**Concept:** mạnh khi đông địch — sét nhảy dây chuyền + tê liệt + nổ.

**Đạn Sét** *(% viên hóa sét, trúng thì lan sang N địch gần)*
| Mốc | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|
| Tỉ lệ | 15% | 22% | 30% | 40% | 50% |
| Số mục tiêu lan | 2 | 2 | 3 | 3 | 4 |
| Sát thương lan | 1 | 1 | 2 | 2 | 3 |

**Tê Liệt** *(% đòn trúng làm địch đứng hình — dừng hẳn)*
| Mốc | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|
| Tỉ lệ | 10% | 18% | 26% | 34% | 42% |
| Thời gian | 0.6s | 0.8s | 1.0s | 1.2s | 1.5s |

**Trường Tĩnh Điện** *(aura quanh player, giật địch mỗi 0.5s)*
| Mốc | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|
| Bán kính | 120 | 150 | 180 | 210 | 240 |
| Sát thương / tick | 1 | 1 | 2 | 2 | 3 |

**Quá Tải** *(trúng địch ĐANG tê liệt → nổ điện AoE — combo với Tê Liệt)*
| Mốc | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|
| Sát thương | 2 | 3 | 3 | 4 | 5 |
| Bán kính | 70 | 80 | 90 | 100 | 110 |

**Sét Dội** *(mỗi lần NẢY → phóng sét lan)*
| Mốc | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|
| Số mục tiêu lan | 1 | 1 | 2 | 2 | 3 |
| Sát thương | 1 | 1 | 2 | 2 | 3 |

---

## Slide 8 — ✨ PHỤ TRỢ (Khuếch đại / tiện ích)
**Concept:** không gắn hệ — ghép vào mọi build để khuếch đại hoặc thêm tiện ích.

**Tốc độ bay** — tốc độ đạn ×: `1.15 → 1.30 → 1.45 → 1.60 → 1.80`

**Bạo kích** — tỉ lệ gây **gấp đôi sát thương gốc**: `10% → 18% → 26% → 34% → 42%`

**Tách rời** *(1 mốc)* — **33%** khi trúng, viên đạn **tách làm đôi**.

**Hấp thu EXP** — +EXP nhận được: `+5% → +10% → +15% → +20% → +25%`

**Tường Nảy** *(vừa cho đạn nảy thêm, vừa CHẶN địch)*
| Mốc | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|
| Số tường | 1 | 1 | 2 | 2 | 3 |
| Tồn tại | 6s | 6.5s | 7s | 7.5s | 8s |
| Hồi (tạo lại) | 6s | 5.5s | 5s | 4.5s | 4s |

---

## Slide 9 — Đa hệ trên 1 viên đạn (điểm nhấn)
- Mỗi viên **roll độc lập** từng hệ (Đạn lửa/gió/đất/sét, mỗi cái ~15–50% theo cấp) → 1 viên có thể **mang nhiều hệ cùng lúc**.
- Tô màu theo **ưu tiên Lửa → Điện → Đất → Gió**, viên đa hệ có **viền màu hệ phụ**.
- Màu: Lửa cam `#ff6b35` · Điện vàng `#ffe14d` · Đất nâu `#b5793b` · Gió ngọc `#38d9c0`.

## Slide 10 — Combo / build mẫu (gợi ý nói)
- **Đốt chảy (Lửa)**: Bỏng + Đạn lửa + tăng số nảy + Vệt Lửa/Lửa Dội → biển lửa cộng dồn.
- **Khóa cứng (Điện)**: Tê Liệt + Quá Tải + Đạn Sét → đứng hình rồi nổ dây chuyền.
- **Pháo đài (Đất)**: Đạn đất + Đạn nặng + Tường Nảy → vây chậm, chặn, đẩy lùi.
- **Nảy loạn (Gió)**: tăng nảy nền + Gió Dội + Tường Nảy → đạn nảy khắp màn, mọi hiệu ứng "Dội" bùng liên tục.
