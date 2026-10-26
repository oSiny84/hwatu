# 화투 게임 효과음 패키지

- **파일**: `wav/` 아래 30개 오리지널 합성 효과음
- **포맷**: 44,100 Hz, 16-bit PCM, mono WAV
- **미리듣기**: `preview.html`을 브라우저에서 실행 (인터넷 불필요)
- **목록**: `manifest.csv` (파일명, 효과음 이벤트, 길이, dBFS)
- **용도**: 화투/고스톱 게임, UI, 프로토타입. 외부 음원 샘플을 사용하지 않은 절차적 합성음.

## 설계 원칙
1. 패 내기·패 겹치기·버튼 클릭 등 빈번한 소리는 짧고 낮은 레벨로 설계.
2. 폭탄·총통·싹쓸이·승리 등 이벤트는 비교적 높은 피크레벨로 구분.
3. "고!"는 보이스가 아닌 타격감 있는 전자 강조음 1/2/3고로 분리.
4. 패 먹기는 착착 2회가 기본. 먹는 장수에 맞춰 `02_card_stack.wav`를 60~110 ms 간격으로 추가 재생할 수도 있음.
5. 실제 게임에서 개별 효과음에 masterSfxGain을 적용하고, 음악과 음량을 맞춰 조정.

## 폴더 설명

- `wav/01_card_play.wav`: 패 내기
- `wav/02_card_stack.wav`: 패 겹치기
- `wav/03_deck_flip.wav`: 더미 뒤집기
- `wav/04_card_collect.wav`: 패 먹기
- `wav/05_your_turn.wav`: 내 차례 알림
- `wav/06_ppuk.wav`: 뻑
- `wav/07_ppuk_recovery.wav`: 뻑 회수/자뻑
- `wav/08_jjok.wav`: 쪽
- `wav/09_ttadak.wav`: 따닥
- `wav/10_sweep.wav`: 싹쓸이
- `wav/11_steal_pi.wav`: 피 빼앗기
- `wav/12_shake.wav`: 흔들기
- `wav/13_bomb.wav`: 폭탄
- `wav/14_chongtong.wav`: 총통
- `wav/15_bonus.wav`: 보너스패
- `wav/16_deal.wav`: 패 나누기
- `wav/17_choose_first.wav`: 선 정하기
- `wav/18_go_1.wav` / `19_go_2.wav` / `20_go_3.wav`: 고 선언
- `wav/21_stop_win.wav`: 스톱/승리
- `wav/22_lose.wav`: 패배
- `wav/23_nagari.wav`: 나가리
- `wav/24_money_transfer.wav`: 돈 이동
- `wav/25_final_settlement.wav`: 최종 정산
- `wav/26_ui_button.wav`: 버튼
- `wav/27_dialog_warning.wav`: 확인/경고창
- `wav/28_user_join.wav`: 입장
- `wav/29_user_leave.wav`: 퇴장
- `wav/30_disconnect.wav`: 연결 끊김

## 게임 연결 예제 (JavaScript)

```js
const wav = (filename, volume = 0.5) => {
  const a = new Audio(`wav/${filename}`);
  a.volume = volume;
  return a.play();
};

wav('01_card_play.wav', 0.35);
wav('13_bomb.wav', 0.7);
```

주의: HTML `file://` 미리듣기는 동작하지만 실제 게임에 통합할 때는 오디오 리소스 캐싱(HTMLAudioElement 풀 또는 Web Audio 버퍼)을 권장.
