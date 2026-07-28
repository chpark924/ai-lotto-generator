/**
 * 추첨일 로컬 알림.
 *
 * 서버 푸시가 아니라 expo-notifications의 "로컬 예약 알림"을 사용한다.
 * 기기 안에서 알람을 예약하는 것이므로 서버 비용이나 별도 인프라가 전혀 필요 없다.
 */
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

const NOTIFICATION_IDENTIFIER = "weekly-draw-reminder";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function requestNotificationPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

/** 매주 토요일 저녁, 추첨 전에 로컬 알림을 예약한다. */
export async function scheduleWeeklyDrawReminder(hour = 20, minute = 0): Promise<boolean> {
  const granted = await requestNotificationPermission();
  if (!granted) return false;

  await cancelWeeklyDrawReminder();

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("draw-reminder", {
      name: "추첨일 알림",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  await Notifications.scheduleNotificationAsync({
    identifier: NOTIFICATION_IDENTIFIER,
    content: {
      title: "오늘 로또 추첨이 있어요",
      body: "저장해둔 번호를 확인하고, 이번 주 운명을 만들어보세요.",
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
      weekday: 7, // expo-notifications 기준 1=일요일 ... 7=토요일
      hour,
      minute,
    },
  });

  return true;
}

export async function cancelWeeklyDrawReminder(): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(NOTIFICATION_IDENTIFIER).catch(() => undefined);
}
