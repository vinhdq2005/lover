import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
export function RetentionHelp() {
  const [warning, setWarning] = useState(false);
  useEffect(() => {
    let active = true;
    void supabase().rpc("resource_health").then(({ data }) => {
      if (active) setWarning(!!data?.db_warning);
    });
    return () => {
      active = false;
    };
  }, []);
  return (
    <section className="card grid gap-3">
      <h2>Lưu giữ và dung lượng</h2>
      <p>
        Kỷ niệm, ảnh, nhật ký và hồ sơ được giữ đến khi bạn chủ động sửa hoặc
        xóa. Thông báo và dữ liệu vận hành hết hạn sau 90 ngày; biên nhận được
        giữ đến khi thao tác hết hạn thêm ít nhất 24 giờ. Bản sao lưu do ứng
        dụng quản lý phải được mã hóa và luân chuyển trong 30 ngày.
      </p>
      <p>
        Dịch vụ miễn phí có thể tạm dừng hoặc hết hạn mức. Khi gần giới hạn, hãy
        liên hệ người vận hành để kiểm tra dung lượng và sao lưu.
      </p>
      {warning && (
        <p role="alert">
          Cơ sở dữ liệu gần đầy. Một số nội dung mới có thể bị tạm ngừng; chức
          năng xóa và khôi phục vẫn hoạt động.
        </p>
      )}
    </section>
  );
}
