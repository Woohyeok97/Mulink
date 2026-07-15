// POST /coach-profiles/upload-url 요청 body. 업로드할 파일의 MIME 타입만 받는다.
export interface UploadUrlDto {
  contentType: string;
}
