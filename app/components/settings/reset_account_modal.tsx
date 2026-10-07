import { Modal } from "antd";
import { type FormEvent, useState } from "react";
import { useNavigate } from "react-router";
import { AppleInput } from "~/components/xui/apple_input";
import { toastSuccess } from "~/components/xui/toast";
import { logout, updateCredentials } from "~/service/api/user/user";

// 沿用现有 RSA 请求接口，限制输入长度，避免异常长凭据进入表单。
const MAX_CREDENTIAL_LENGTH = 64;

/** 默认凭据登录后先在桌面修改账号，保存成功再清除旧会话并重新登录。 */
export default function ResetAccountModal({ open }: { open: boolean }) {
  const navigate = useNavigate();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  /** 校验三个字段并复用修改接口；失败时保留输入，避免把未保存的凭据当作成功。 */
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    if (!username.trim() || !password) {
      setError("请输入用户名和密码");
      return;
    }
    if (password !== confirmPassword) {
      setError("两次输入的密码不一致");
      return;
    }
    if (username.trim() === "admin" && password === "admin") {
      setError("请修改默认用户名或密码");
      return;
    }
    setPending(true);
    setError("");
    try {
      await updateCredentials({
        username: username.trim(),
        password,
        old_password: "admin",
      });
      logout();
      toastSuccess("账号和密码已更新，请重新登录");
      navigate("/", { replace: true });
    } catch (cause) {
      const failure = cause as {
        response?: { data?: { msg?: string } };
        message?: string;
      };
      setError(
        failure.response?.data?.msg || failure.message || "保存失败，请重试",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal
      open={open}
      title="修改默认账号和密码"
      centered
      width={420}
      footer={null}
      closable={false}
      keyboard={false}
      mask={{ closable: false }}
    >
      <p className="mb-5 text-xs leading-5 text-slate-500">
        当前使用默认凭据，请设置自己的账号和密码。保存后需要重新登录。
      </p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <AppleInput
          label="用户名"
          aria-label="用户名"
          value={username}
          onChange={setUsername}
          required
          maxLength={MAX_CREDENTIAL_LENGTH}
          autoComplete="username"
          autoFocus
          disabled={pending}
        />
        <AppleInput
          label="密码"
          aria-label="密码"
          type="password"
          value={password}
          onChange={setPassword}
          required
          maxLength={MAX_CREDENTIAL_LENGTH}
          autoComplete="new-password"
          fontMono={false}
          allowTogglePassword
          disabled={pending}
        />
        <AppleInput
          label="再次输入密码"
          aria-label="再次输入密码"
          type="password"
          value={confirmPassword}
          onChange={setConfirmPassword}
          required
          maxLength={MAX_CREDENTIAL_LENGTH}
          autoComplete="new-password"
          fontMono={false}
          allowTogglePassword
          disabled={pending}
        />
        {error && (
          <p role="alert" className="text-xs text-red-600">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={pending}
          className="apple-btn-capsule w-full bg-slate-900 px-5 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-black disabled:opacity-50"
        >
          {pending ? "保存中..." : "保存并重新登录"}
        </button>
      </form>
    </Modal>
  );
}
