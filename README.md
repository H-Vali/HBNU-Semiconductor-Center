# HBNU Semiconductor Center

기관 장비 소개, 교육 신청, 장비 예약, 관리자 CMS를 포함한 장비 관리 및 예약 시스템입니다.

## 포함 범위

- React + TypeScript + Tailwind 기반 다크모드 운영 포털
- Express + PostgreSQL API 설계
- Google/Kakao OAuth 확장 가능한 JWT 인증 구조
- RBAC 기반 사용자/Admin 접근 제어
- 장비 24종 샘플 데이터, 예약/교육 흐름, 관리자 페이지
- Docker Compose, Kubernetes 매니페스트, GitHub Actions CI/CD 초안

## 빠른 실행

```bash
npm install
npm run dev
```

API까지 함께 실행하려면:

```bash
npm run dev:api
```

## 환경 변수

`.env.example`을 복사해 `.env`로 만든 뒤 값을 채웁니다.

```bash
cp .env.example .env
```

## GitHub 저장/배포

원격 저장소:

```bash
git remote add origin https://github.com/H-Vali/HBNU-Semiconductor-Center.git
git push -u origin main
```

GitHub Actions는 `main` 브랜치 푸시 시 빌드 검증을 수행하고, Docker 이미지 빌드 및 Kubernetes 배포 단계로 확장할 수 있게 구성되어 있습니다.
