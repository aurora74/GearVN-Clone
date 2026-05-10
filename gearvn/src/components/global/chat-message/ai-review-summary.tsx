import { AssistantReviewSummary } from "@/types/chat";

type AiReviewSummaryProps = {
  summary: AssistantReviewSummary;
};

export const AiReviewSummary = ({ summary }: AiReviewSummaryProps) => {
  const citedSources = summary.citations ?? [];
  const repeatedGroup = summary.repeatedFindings;
  const verificationGroup = summary.needsVerification;
  const insufficientGroup = summary.insufficientSources;
  const repeatedClaims = repeatedGroup?.claims ?? [];
  const verificationClaims = verificationGroup?.claims ?? [];
  const insufficientClaims = insufficientGroup?.claims ?? [];
  const uncertainty = summary.uncertainty ?? [];

  return (
    <section className="w-full space-y-2 rounded-md border border-blue-100 bg-blue-50/60 p-3 text-gray-900">
      <div>
        <h3 className="text-sm font-semibold">
          {summary.heading || "Tóm tắt đánh giá từ nguồn công khai"}
        </h3>
        {summary.productName && (
          <p className="mt-0.5 text-xs text-gray-600">{summary.productName}</p>
        )}
      </div>

      <p className="text-sm leading-5">{summary.summary}</p>

      <div className="space-y-2 text-xs">
        <div>
          <p className="font-semibold text-gray-800">
            {repeatedGroup?.label ?? "Nhiều nguồn cùng nhắc"}
          </p>
          {repeatedClaims.length > 0 ? (
            <ul className="mt-1 list-disc space-y-1 pl-4 text-gray-600">
              {repeatedClaims.map((claim, index) => (
                <li key={`${claim.text}-${index}`}>{claim.text}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-gray-500">Chưa có điểm lặp lại rõ ràng.</p>
          )}
        </div>

        <div>
          <p className="font-semibold text-gray-800">
            {verificationGroup?.label ?? "Cần kiểm chứng"}
          </p>
          <ul className="mt-1 list-disc space-y-1 pl-4 text-gray-600">
            {verificationClaims.length > 0 ? (
              verificationClaims.map((claim, index) => (
                <li key={`${claim.text}-${index}`}>
                  {claim.text}
                  {claim.uncertainty ? ` ${claim.uncertainty}` : ""}
                </li>
              ))
            ) : uncertainty.length > 0 ? (
              uncertainty.map((item, index) => (
                <li key={`${item}-${index}`}>{item}</li>
              ))
            ) : (
              <li>Đối chiếu lại giá, tồn kho và ưu đãi tại thời điểm mua.</li>
            )}
          </ul>
        </div>

        <div>
          <p className="font-semibold text-gray-800">
            {insufficientGroup?.label ?? "Chưa đủ nguồn"}
          </p>
          {insufficientClaims.length > 0 ? (
            <ul className="mt-1 list-disc space-y-1 pl-4 text-gray-600">
              {insufficientClaims.map((claim, index) => (
                <li key={`${claim.text}-${index}`}>{claim.text}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-gray-600">
              Các nhận xét ít nguồn sẽ chỉ được xem là tín hiệu tham khảo, không
              phải kết luận chắc chắn.
            </p>
          )}
        </div>

        <div>
          <p className="font-semibold text-gray-800">Nguồn</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {citedSources.length > 0 ? (
              citedSources.map((citation, index) => (
                <a
                  key={`${citation.url}-${index}`}
                  href={citation.url}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`Mở nguồn ${index + 1}`}
                  className="min-h-8 rounded-sm border border-blue-200 bg-white px-2 py-1 text-blue-700 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  {citation.source || citation.title || `Nguồn ${index + 1}`}
                </a>
              ))
            ) : (
              <span className="text-gray-500">Chưa có nguồn trích dẫn.</span>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
