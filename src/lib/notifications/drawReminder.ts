/**
 * 추첨일 로컬 알림.
 *
 * 서버 푸시가 아니라 expo-notifications의 "로컬 예약 알림"을 사용한다.
 * 기기 안에서 알람을 예약하는 것이므로 서버 비용이나 별도 인프라가 전혀 필요 없다.
 *
 * 중요: expo-notifications를 파일 최상단에서 바로 import하면, 실제로 알림 기능을
 * 쓰지 않는 화면에서도 이 모듈이 딸려 들어오는 순간 내부 부수효과
 * (DevicePushTokenAutoRegistration)가 즉시 실행된다. Expo Go(SDK 53 이상)에서는
 * 이 부수효과 자체가 에러를 던져서, 알림 설정을 켜지도 않았는데 앱이 시작하자마자
 * 죽는 문제가 있었다. 그래서 실제로 알림 기능을 호출하는 시점에만 동적으로 로드한다.
 * 개발 빌드(native build)에서는 기존과 동일하게 동작하고, Expo Go에서는 사용자가
 * 알림을 실제로 켤 때만(그리고 그때만) 영향을 받는다.
 */
import { Platform } from "react-native";

const DRAW_REMINDER_ID = "weekly-draw-reminder";
/** 로또 구매 마감 하루 전(금요일) 알림. */
const PURCHASE_DEADLINE_EVE_ID = "weekly-purchase-deadline-eve-reminder";
/** 로또 구매 마감 당일(토요일) 알림. 마감 시각과 무관하게 오후 6시 고정 발송. */
const PURCHASE_DEADLINE_DAY_ID = "weekly-purchase-deadline-day-reminder";

type NotificationsModule = typeof import("expo-notifications");

let notificationsModule: NotificationsModule | null = null;
let handlerConfigured = false;

async function getNotifications(): Promise<NotificationsModule> {
  if (!notificationsModule) {
    notificationsModule = await import("expo-notifications");
  }
  if (!handlerConfigured) {
    notificationsModule.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
    handlerConfigured = true;
  }
  return notificationsModule;
}

export async function requestNotificationPermission(): Promise<boolean> {
  const Notifications = await getNotifications();
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

/**
 * 로또 구매·추첨 관련 로컬 알림을 한 번에 예약한다 (토글 하나로 3건 관리).
 *  1) 구매 마감 하루 전 (금요일, hour/minute 설정값)
 *  2) 구매 마감 당일 (토요일, 오후 6시 고정) — 마감 직전 마지막 구매 알림
 *  3) 추첨 임박 (토요일, hour/minute 설정값, 기본 오후 8시) — 기존 알림
 */
export async function scheduleWeeklyDrawReminder(hour = 20, minute = 0): Promise<boolean> {
  const Notifications = await getNotifications();
  const granted = await requestNotificationPermission();
  if (!granted) return false;

  await cancelWeeklyDrawReminder();

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("draw-reminder", {
      name: "추첨일 알림",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  // expo-notifications 기준 weekday: 1=일요일 ... 6=금요일, 7=토요일
  await Notifications.scheduleNotificationAsync({
    identifier: PURCHASE_DEADLINE_EVE_ID,
    content: {
      title: "내일이 로또 구매 마감일이에요",
      body: "저장해둔 번호를 아직 구매하지 않았다면 잊지 말고 준비해두세요.",
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
      weekday: 6,
      hour,
      minute,
    },
  });

  await Notifications.scheduleNotificationAsync({
    identifier: PURCHASE_DEADLINE_DAY_ID,
    content: {
      title: "오늘이 로또 구매 마감일이에요",
      body: "구매 마감 전에 저장해둔 번호를 확인하고 구매를 완료하세요.",
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
      weekday: 7,
      hour: 18,
      minute: 0,
    },
  });

  await Notifications.scheduleNotificationAsync({
    identifier: DRAW_REMINDER_ID,
    content: {
      title: "오늘 로또 추첨이 있어요",
      body: "저장해둔 번호를 확인하고, 이번 주 운명을 만들어보세요.",
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
      weekday: 7,
      hour,
      minute,
    },
  });

  return true;
}

export async function cancelWeeklyDrawReminder(): Promise<void> {
  const Notifications = await getNotifications();
  await Promise.all([
    Notifications.cancelScheduledNotificationAsync(PURCHASE_DEADLINE_EVE_ID).catch(() => undefined),
    Notifications.cancelScheduledNotificationAsync(PURCHASE_DEADLINE_DAY_ID).catch(() => undefined),
    Notifications.cancelScheduledNotificationAsync(DRAW_REMINDER_ID).catch(() => undefined),
  ]);
}
