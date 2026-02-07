import { useState, useEffect } from 'react';
import dayjs from 'dayjs';

interface CountDownProps {
  endTime: string;
  onEnd?: () => void;
}

export default function CountDown({ endTime, onEnd }: CountDownProps) {
  const [timeStr, setTimeStr] = useState('');
  const [urgent, setUrgent] = useState(false);

  useEffect(() => {
    const update = () => {
      const now = dayjs();
      const end = dayjs(endTime);
      const diff = end.diff(now, 'second');

      if (diff <= 0) {
        setTimeStr('已结束');
        setUrgent(false);
        onEnd?.();
        return false;
      }

      const days = Math.floor(diff / 86400);
      const hours = Math.floor((diff % 86400) / 3600);
      const minutes = Math.floor((diff % 3600) / 60);
      const seconds = diff % 60;

      if (days > 0) {
        setTimeStr(`${days}天 ${hours}时 ${minutes}分`);
      } else if (hours > 0) {
        setTimeStr(`${hours}时 ${minutes}分 ${seconds}秒`);
      } else {
        setTimeStr(`${minutes}分 ${seconds}秒`);
      }

      setUrgent(diff < 300); // Less than 5 minutes
      return true;
    };

    if (!update()) return;
    const timer = setInterval(() => {
      if (!update()) clearInterval(timer);
    }, 1000);

    return () => clearInterval(timer);
  }, [endTime, onEnd]);

  return (
    <span style={{ color: urgent ? '#ff4d4f' : undefined, fontWeight: urgent ? 600 : undefined }}>
      {timeStr}
    </span>
  );
}
