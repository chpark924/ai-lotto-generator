/**
 * 루트 레이아웃에서 한 번 호출하는 업데이트 안내 훅 (appUpdate.ts 참고).
 * - 앱을 켜면(스플래시가 걷힌 뒤) 한 번 확인한다.
 * - "필수" 안내 상태에서 스토어에 다녀와 앱으로 돌아왔는데 아직 옛 버전이면 다시 띄운다.
 *   "권장"은 앱을 켤 때만 확인해 같은 세션에서 반복해 귀찮게 하지 않는다.
 */
import { useEffect, useRef } from "react";
import { Alert, AppState, Platform } from "react-native";
import {
  decideUpdate,
  fetchAppUpdateConfig,
  getDismissedVersionCode,
  getInstalledVersionCode,
  openStorePage,
  rememberDismissed,
} from "./appUpdate";

const FIRST_CHECK_DELAY_MS = 1500;

export function useAppUpdatePrompt(): void {
  const showing = useRef(false);
  const requiredPending = useRef(false);

  useEffect(() => {
    if (Platform.OS !== "android") return;
    let cancelled = false;

    async function check() {
      if (showing.current) return;
      const [config, dismissed] = await Promise.all([fetchAppUpdateConfig(), getDismissedVersionCode()]);
      if (cancelled) return;
      const decision = decideUpdate(getInstalledVersionCode(), config, dismissed);
      if (decision.kind === "none") {
        requiredPending.current = false;
        return;
      }
      showing.current = true;
      if (decision.kind === "required") {
        requiredPending.current = true;
        Alert.alert(
          "업데이트가 필요해요",
          decision.message,
          [
            {
              text: "업데이트",
              onPress: () => {
                showing.current = false;
                openStorePage();
              },
            },
          ],
          { cancelable: false }
        );
        return;
      }
      Alert.alert(
        "새 버전이 나왔어요",
        decision.message,
        [
          {
            text: "나중에",
            style: "cancel",
            onPress: () => {
              showing.current = false;
              rememberDismissed(decision.latestVersionCode);
            },
          },
          {
            text: "업데이트",
            onPress: () => {
              showing.current = false;
              openStorePage();
            },
          },
        ],
        {
          cancelable: true,
          // 안드로이드 뒤로가기로 닫은 것도 "나중에"와 같이 취급한다.
          onDismiss: () => {
            showing.current = false;
            rememberDismissed(decision.latestVersionCode);
          },
        }
      );
    }

    const timer = setTimeout(check, FIRST_CHECK_DELAY_MS);
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active" && requiredPending.current) check();
    });
    return () => {
      cancelled = true;
      clearTimeout(timer);
      sub.remove();
    };
  }, []);
}
