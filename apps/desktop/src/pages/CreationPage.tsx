import { ImagePlus, Upload, WandSparkles } from 'lucide-react';
import { Badge, Button } from '@weavia/ui';
const modelOptions = ['温雅', '利落', '自然'];
const sceneOptions = ['极简影棚', '暖调居家', '城市光影'];
export function CreationPage({ kind }: { kind: 'model' | 'commercial' }) {
  const isModel = kind === 'model';
  const options = isModel ? modelOptions : sceneOptions;
  return (
    <div className="studio">
      <aside className="materials">
        <p className="panel-label">商品素材</p>
        <button className="upload-tile">
          <Upload size={19} />
          <strong>添加商品</strong>
          <span>JPG · PNG · WEBP</span>
        </button>
        <p className="local-note">素材仅在生成时按需上传</p>
      </aside>
      <section className="canvas">
        <div className="canvas-empty">
          <span>
            <ImagePlus />
          </span>
          <h1>添加一件商品，开始{isModel ? '模特' : '商拍'}创作</h1>
          <p>
            {isModel ? '上传商品图，选择模特、姿势与背景。' : '上传商品图，选择场景、风格与构图。'}
          </p>
          <Button>
            <Upload size={15} /> 添加商品图片
          </Button>
          <small>支持拖放 · 单张最大 20 MB</small>
        </div>
      </section>
      <aside className="parameters">
        <div className="parameters-scroll">
          <p className="panel-label">创作参数</p>
          <div className="field">
            <label>{isModel ? '选择模特' : '选择场景'}</label>
            <div className="option-grid">
              {options.map((x, i) => (
                <button className={i === 0 ? 'selected' : ''} key={x}>
                  <span className={`option-visual option-${i}`} />
                  {x}
                  {i === 0 && <Badge tone="accent">推荐</Badge>}
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <label>{isModel ? '姿势' : '视觉风格'}</label>
            <div className="segments">
              <button className="active">{isModel ? '自动' : '高级'}</button>
              <button>{isModel ? '站立' : '自然'}</button>
              <button>{isModel ? '行走' : '明亮'}</button>
            </div>
          </div>
          <div className="field">
            <label>{isModel ? '背景' : '构图'}</label>
            <select>
              <option>{isModel ? '摄影棚' : '自动构图'}</option>
            </select>
          </div>
          <div className="field split">
            <div>
              <label>比例</label>
              <select>
                <option>3:4</option>
              </select>
            </div>
            <div>
              <label>质量</label>
              <select>
                <option>标准</option>
              </select>
            </div>
          </div>
          <div className="field">
            <label>生成数量</label>
            <div className="segments">
              <button>1</button>
              <button>2</button>
              <button className="active">4</button>
            </div>
          </div>
        </div>
        <footer className="generate-footer">
          <div>
            <span>预计消耗</span>
            <strong>{isModel ? '80' : '60'} Credits</strong>
          </div>
          <Button disabled>
            <WandSparkles size={15} /> 开始生成
          </Button>
          <small>添加商品后可生成 · 成功后结算</small>
        </footer>
      </aside>
    </div>
  );
}
