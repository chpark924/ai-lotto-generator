import { Share } from "react-native";
import { shareFeedTemplate } from "@react-native-kakao/share";

/**
 * [10차 업데이트 — 카카오톡 공유 카드, 2026-09-20]
 * 기존 handleShare()는 Share.share({ message })만 호출해서 어떤 메신저로 공유하든
 * 순수 텍스트만 전송됐다(QA_LOG #153 참고). 카카오톡에서는 이미지·제목·설명·"앱으로
 * 이동" 버튼이 있는 카드(Feed 템플릿)로 공유되도록 이 헬퍼를 새로 만들었다.
 *
 * - 카카오톡이 설치돼 있으면 Feed 템플릿 카드로 공유된다.
 * - 카카오톡이 없으면 `useWebBrowserIfKakaoTalkNotAvailable: true` 옵션 덕분에
 *   패키지가 자체적으로 웹 공유창으로 폴백해준다.
 * - 그마저 실패하는 예외 상황(네트워크 오류 등 shareFeedTemplate 자체가 reject되는 경우)에는
 *   기존처럼 OS 기본 공유 시트(Share.share)로 한 번 더 폴백한다 — 어떤 경우에도 "공유가
 *   아예 안 되는" 상황은 없게 만드는 게 목표.
 */

// 기존 GitHub 저장소 배포 패턴(당첨번호 데이터와 동일)으로 올린 공유 카드 브랜딩 이미지.
const SHARE_IMAGE_URL =
  "https://raw.githubusercontent.com/chpark924/ai-lotto-generator/main/assets/kakao-share-card.png";

// [TODO] 플레이스토어 정식 출시 전까지는 이 URL이 실제로 열리지 않는다(스토어 등록 전이라
// 404). 패키지명 기준으로 미리 만들어둔 값이라 출시 즉시 그대로 유효해지므로, 출시 후
// 별도 코드 수정 없이 자동으로 정상 동작한다. 카카오 디벨로퍼스 "플랫폼 키" 화면의
// Android 스토어 URL도 출시 시점에 함께 등록해줄 것.
const APP_STORE_URL = "https://play.google.com/store/apps/details?id=com.geumsonlotto.app";

async function shareViaKakaoFeed(params: { title: string; description: string }): Promise<void> {
  await shareFeedTemplate({
    template: {
      content: {
        title: params.title,
        description: params.description,
        imageUrl: SHARE_IMAGE_URL,
        link: {
          webUrl: APP_STORE_URL,
          mobileWebUrl: APP_STORE_URL,
        },
      },
      buttons: [
        {
          title: "앱에서 확인하기",
          link: {
            webUrl: APP_STORE_URL,
            mobileWebUrl: APP_STORE_URL,
          },
        },
      ],
    },
    useWebBrowserIfKakaoTalkNotAvailable: true,
  });
}

/**
 * 카카오톡 Feed 카드로 공유를 시도하고, 완전히 실패하면 OS 기본 공유 시트로 폴백한다.
 * @param title Feed 카드 제목 (예: "내 로또 번호: 1 · 2 · 3 · 4 · 5 · 6")
 * @param description Feed 카드 설명 (짧게 — 너무 길면 카카오톡에서 잘려 보일 수 있음)
 * @param fallbackMessage OS 기본 공유 시트(Share.share)용 순수 텍스트. 기존 handleShare()가
 *   쓰던 메시지를 그대로 넘기면 된다.
 */
export async function shareLottoNumbers(
  title: string,
  description: string,
  fallbackMessage: string
): Promise<void> {
  try {
    await shareViaKakaoFeed({ title, description });
  } catch {
    try {
      await Share.share({ message: fallbackMessage });
    } catch {
      // 사용자가 공유를 취소한 경우 등은 조용히 무시한다(기존 handleShare()들의 동작과 동일).
    }
  }
}
