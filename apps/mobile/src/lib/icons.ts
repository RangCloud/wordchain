import type Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';

/** Ionicons 아이콘 이름 타입. 오타가 나면 컴파일 단계에서 잡힌다 */
export type IconName = ComponentProps<typeof Ionicons>['name'];
