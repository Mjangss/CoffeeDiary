# Coffee Diary

개인 커피 추출 기록, 원두·재고·레시피와 분쇄도 보정을 관리하는 웹 앱입니다.

## 시작하기

Node.js 22와 npm을 설치한 뒤 다음을 실행합니다.

```bash
cp .env.example .env
npm ci
npm run dev
```

`.env`에는 Firebase 웹 앱 설정값을 넣습니다. 이 값은 브라우저 앱 구성용이며, Firebase 서비스 계정 키처럼 서버 비밀정보를 넣으면 안 됩니다.

## 검증과 빌드

```bash
npm run typecheck
npm test
npm run build
```

`npm run verify`는 위 검증을 순서대로 실행합니다.

## 배포

Hosting 배포 전에는 검증을 통과해야 합니다.

```bash
npm run verify
firebase deploy --only hosting:coffeediary --project project-465199901526426309
```

Firestore Rules는 Hosting과 별도로 배포합니다. 권한 변경을 검토한 뒤에만 실행하세요.

```bash
firebase deploy --only firestore:rules --project project-465199901526426309
```

GitHub Actions는 Pull Request에서 타입 검사·테스트·빌드를 수행합니다. `main` 브랜치에서는 검증 성공 뒤 Hosting을 배포합니다. 배포 환경에는 `VITE_FIREBASE_*` 값을 GitHub Secrets로 설정하고, `FIREBASE_SERVICE_ACCOUNT`에는 Firebase 서비스 계정 JSON을 설정합니다.

`scripts/`와 `scratch/`의 리팩터링 파일은 과거 일회성 보조 도구이며, 앱 실행이나 배포 과정에서는 사용하지 않습니다.
